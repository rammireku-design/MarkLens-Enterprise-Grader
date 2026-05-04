import { createClient } from '@supabase/supabase-js';
import { queueOfflineJob } from './db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing. Ensure you have a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export const uploadImageToStorage = async (base64DataUrl, path) => {
    try {
        const response = await fetch(base64DataUrl);
        const blob = await response.blob();
        
        const { data, error } = await supabase.storage
            .from('exam_papers')
            .upload(path, blob, {
                contentType: blob.type,
                upsert: true
            });
            
        if (error) throw error;
        
        const { data: publicUrlData } = supabase.storage
            .from('exam_papers')
            .getPublicUrl(path);
            
        return publicUrlData.publicUrl;
    } catch (err) {
        console.error("Storage upload failed:", err);
        throw err;
    }
};

export const syncMarkingSchemesToCloud = async (userId, schemes) => {
    if (!userId || !schemes) return;
    
    const { error: delErr } = await supabase.from('marking_schemes').delete().eq('user_id', userId);
    if (delErr) console.error("Sync Wipe Error:", delErr);
    
    if (schemes.length === 0) return;

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    const inserts = schemes.map(s => {
        const payload = {
            user_id: userId,
            title: s.name,
            content: JSON.stringify({ text: s.text, constraints: s.constraints })
        };
        if (isUUID(s.id)) {
            payload.id = s.id; // Only pass client IDs if they are true UUIDs to prevent Postgres cast errors
        }
        return payload;
    });

    const { error: insErr } = await supabase.from('marking_schemes').insert(inserts);
    if (insErr) console.error("Sync Insert Error:", insErr);
};

export const fetchMarkingSchemesFromCloud = async (userId) => {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('marking_schemes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error(error);
        return [];
    }
    
    return data.map(d => {
        const parsed = JSON.parse(d.content);
        return {
            id: d.id, // Use DB UUID as local ID now
            name: d.title,
            text: parsed.text,
            constraints: parsed.constraints
        };
    });
};

export const syncHistoryBatchToCloud = async (userId, batch) => {
    if (!userId || !batch) return;

    try {
        // Insert Batch
        const { data: batchData, error: batchError } = await supabase
            .from('grading_batches')
            .insert({
                id: batch.id, // Professional Client-Side Generated UUID
                user_id: userId,
                batch_name: batch.batchName,
                paper_count: batch.paperCount,
                status: batch.status,
                date_created: batch.dateCreated
            })
            .select()
            .single();

        if (batchError) throw batchError;
        const dbBatchId = batchData.id;

        // Upload images and construct script inserts
        for (const script of batch.scripts) {
            let uploadedUrls = [];
            
            // Upload physical images to Storage
            if (script.dataUrls && script.dataUrls.length > 0) {
                for (let i = 0; i < script.dataUrls.length; i++) {
                    const safeName = (script.name || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const path = `${userId}/${dbBatchId}/${safeName}_page${i}.png`;
                    const publicUrl = await uploadImageToStorage(script.dataUrls[i], path);
                    uploadedUrls.push(publicUrl);
                }
            } else if (script.dataUrl) {
                const safeName = (script.name || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const path = `${userId}/${dbBatchId}/${safeName}_page0.png`;
                const publicUrl = await uploadImageToStorage(script.dataUrl, path);
                uploadedUrls.push(publicUrl);
            }

            await supabase
                .from('student_scripts')
                .insert({
                    batch_id: dbBatchId,
                    user_id: userId,
                    name: script.name,
                    status: script.status,
                    grade_result: script.gradeResult,
                    image_urls: uploadedUrls,
                    extracted_text: script.extractedText
                });
        }
        
    } catch (err) {
        console.error("Failed to sync batch to cloud, queuing for offline sync:", err);
        try {
            await queueOfflineJob({ type: 'SYNC_BATCH', userId, batchData });
        } catch (queueErr) {
            console.error("Failed to enqueue offline job:", queueErr);
        }
    }
};

export const fetchHistoryFromCloud = async (userId) => {
    if (!userId) return [];
    
    try {
        const { data: batches, error: batchErr } = await supabase
            .from('grading_batches')
            .select(`
                id, batch_name, paper_count, status, date_created,
                student_scripts (
                    id, name, status, grade_result, image_urls, extracted_text
                )
            `)
            .eq('user_id', userId)
            .order('date_created', { ascending: false });

        if (batchErr) throw batchErr;
        
        return batches.map(b => ({
            id: b.id,
            batchName: b.batch_name,
            paperCount: b.paper_count,
            dateCreated: b.date_created,
            status: b.status,
            type: 'Cloud Record',
            scripts: b.student_scripts.map(s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                gradeResult: s.grade_result,
                extractedText: s.extracted_text,
                dataUrls: s.image_urls || [],
                dataUrl: s.image_urls ? s.image_urls[0] : null
            }))
        }));
    } catch (err) {
        console.error("Failed to fetch cloud history:", err);
        return [];
    }
};

export const deleteHistoryBatchFromCloud = async (batchId, batchName) => {
    if (!batchId) return;
    try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchId);
        
        if (isUUID) {
            // Force delete scripts first to bypass any missing ON DELETE CASCADE constraints in the user's database
            await supabase.from('student_scripts').delete().eq('batch_id', batchId);
            const { error } = await supabase.from('grading_batches').delete().eq('id', batchId);
            if (error) console.error("Batch Delete Error:", error);
        } else if (batchName) {
            const { data: bData } = await supabase.from('grading_batches').select('id').eq('batch_name', batchName).single();
            if (bData && bData.id) {
                await supabase.from('student_scripts').delete().eq('batch_id', bData.id);
                const { error } = await supabase.from('grading_batches').delete().eq('id', bData.id);
                if (error) console.error("Batch Name Delete Error:", error);
            }
        }
    } catch (err) {
        console.error("Failed to delete cloud history batch:", err);
    }
};

import { supabase } from "@/integrations/supabase/client";

export class StorageService {
  /**
   * Uploads an image file to Supabase Storage organized by organization_id
   * @param file The File object from input[type=file]
   * @param bucket 'delivery-photos' | 'equipment-images'
   * @param organizationId Organization UUID for isolation
   * @returns Public URL of the uploaded image
   */
  static async uploadImage(
    file: File, 
    bucket: "delivery-photos" | "equipment-images", 
    organizationId: string
  ): Promise<string> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${organizationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.warn(`Supabase Storage upload warning (${bucket}):`, uploadError.message);
        // Fallback: convert file to local Data URL (base64) so it works offline/localhost
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Error in StorageService.uploadImage:", err);
      // Fallback base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }

  /**
   * Uploads any file to Supabase Storage organized by organization_id
   */
  static async uploadFile(
    file: File, 
    bucket: string, 
    organizationId: string
  ): Promise<string> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${organizationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.warn(`Supabase Storage upload file warning (${bucket}):`, uploadError.message);
        throw uploadError;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Error in StorageService.uploadFile:", err);
      throw err;
    }
  }
}

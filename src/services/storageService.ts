import { supabase } from "@/integrations/supabase/client";

export class StorageService {
  /**
   * Resizes and compresses image to a lightweight Data URL (max 1000px, ~60-120KB) to prevent QuotaExceededError in localStorage
   */
  static async compressImageToDataUrl(file: File, maxWidth = 1000, maxHeight = 1000): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        if (!src) return resolve("");
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
            const mimeType = isPng ? "image/png" : "image/jpeg";
            resolve(canvas.toDataURL(mimeType, 0.85));
            return;
          }
          resolve(src);
        };
        img.onerror = () => resolve(src);
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Uploads an image file to Supabase Storage organized by organization_id
   * @param file The File object from input[type=file]
   * @param bucket 'delivery-photos' | 'equipment-images'
   * @param organizationId Organization UUID for isolation
   * @returns Public URL or optimized Base64 Data URL
   */
  static async uploadImage(
    file: File, 
    bucket: "delivery-photos" | "equipment-images", 
    organizationId: string,
    fallbackToDataUrl = true
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
        if (!fallbackToDataUrl) throw uploadError;
        return this.compressImageToDataUrl(file);
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Error in StorageService.uploadImage:", err);
      if (!fallbackToDataUrl) throw err;
      return this.compressImageToDataUrl(file);
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
        return this.compressImageToDataUrl(file);
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Error in StorageService.uploadFile:", err);
      return this.compressImageToDataUrl(file);
    }
  }
}

import { supabase, supabaseAdmin } from "@/integrations/supabase/client";
import { MockDataService } from "@/services/mockDataService";
import { 
  Organization, 
  UserProfile, 
  Equipment, 
  Client, 
  Proposal, 
  Contract, 
  FinancialRecord, 
  ServiceOrder,
  EquipmentCatalog,
  EquipmentPricing,
  EquipmentAsset,
  EquipmentStatus,
  Maintenance,
  PricingTierRule,
} from "@/types/locgest";

export class SupabaseDataService {
  // ORGANIZATIONS & AVAILABILITY RULE PERSISTENCE
  static getOrgAvailabilityRule(orgId: string, dbValue?: boolean | null): boolean {
    try {
      const saved = localStorage.getItem(`locgest_org_avail_${orgId}`);
      if (saved !== null) {
        return JSON.parse(saved) === true;
      }
    } catch (e) {}
    return dbValue !== false;
  }

  static setOrgAvailabilityRule(orgId: string, value: boolean): void {
    try {
      localStorage.setItem(`locgest_org_avail_${orgId}`, JSON.stringify(value));
    } catch (e) {}
  }

  static getOrgLetterheadSettings(orgId: string): Partial<Organization> | null {
    try {
      const saved = localStorage.getItem(`locgest_org_letterhead_${orgId}`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  static setOrgLetterheadSettings(orgId: string, org: Organization): void {
    try {
      const payload = {
        letterhead_enabled: org.letterhead_enabled,
        letterhead_watermark_url: org.letterhead_watermark_url,
        letterhead_watermark_opacity: org.letterhead_watermark_opacity,
        logo_url: org.logo_url,
      };
      localStorage.setItem(`locgest_org_letterhead_${orgId}`, JSON.stringify(payload));
    } catch (e) {}
  }

  static async getOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase.from("organizations").select("*");
      const mockOrgs = MockDataService.getOrganizations();

      const mergeOrg = (dbOrg: any, mockOrg: any) => {
        const orgId = dbOrg?.id || mockOrg?.id;
        const savedLetterhead = orgId ? this.getOrgLetterheadSettings(orgId) : null;
        const reqAvail = orgId ? this.getOrgAvailabilityRule(orgId, dbOrg?.require_equipment_availability ?? mockOrg?.require_equipment_availability) : true;

        const watermarkUrl =
          dbOrg?.letterhead_watermark_url ||
          savedLetterhead?.letterhead_watermark_url ||
          mockOrg?.letterhead_watermark_url ||
          null;

        const logoUrl =
          dbOrg?.logo_url ||
          savedLetterhead?.logo_url ||
          mockOrg?.logo_url ||
          null;

        const enabled =
          dbOrg?.letterhead_enabled ??
          savedLetterhead?.letterhead_enabled ??
          mockOrg?.letterhead_enabled ??
          true;

        const opacity =
          dbOrg?.letterhead_watermark_opacity ??
          savedLetterhead?.letterhead_watermark_opacity ??
          mockOrg?.letterhead_watermark_opacity ??
          0.10;

        return {
          ...mockOrg,
          ...dbOrg,
          logo_url: logoUrl,
          letterhead_enabled: enabled,
          letterhead_watermark_url: watermarkUrl,
          letterhead_watermark_opacity: opacity,
          require_equipment_availability: reqAvail,
        };
      };

      if (error || !data || data.length === 0) {
        return mockOrgs.map((m) => mergeOrg(null, m));
      }

      return data.map((dbOrg: any) => {
        const mockMatch = mockOrgs.find((m) => m.id === dbOrg.id);
        return mergeOrg(dbOrg, mockMatch);
      }) as Organization[];
    } catch (e) {
      console.error("Supabase getOrganizations failed:", e);
      return MockDataService.getOrganizations().map((m) => {
        const reqAvail = this.getOrgAvailabilityRule(m.id, m.require_equipment_availability);
        const letterhead = this.getOrgLetterheadSettings(m.id);
        return {
          ...m,
          require_equipment_availability: reqAvail,
          ...(letterhead || {}),
        };
      });
    }
  }

  static async saveOrganization(org: Organization): Promise<void> {
    if (org.id) {
      this.setOrgAvailabilityRule(org.id, org.require_equipment_availability !== false);
      this.setOrgLetterheadSettings(org.id, org);
    }
    MockDataService.saveOrganization(org);

    // Build the DB record with ONLY columns that exist in the Supabase `organizations` table.
    // Original schema columns: id, name, slug, trade_name, cnpj, logo_url, primary_color, plan, status, phone, email, address
    // Added via migrations: ie, address_st, address_number, address_neighborhood, address_city, address_estate, address_zipcode,
    //   require_equipment_availability, letterhead_enabled, letterhead_watermark_url, letterhead_watermark_opacity,
    //   letterhead_header_url, letterhead_footer_url, letterhead_header_text, letterhead_footer_text, letterhead_logo_height, letterhead_header_height
    const dbRecord: Record<string, any> = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      trade_name: org.trade_name || null,
      cnpj: org.cnpj || null,
      logo_url: org.logo_url || null,
      primary_color: org.primary_color || "#0284c7",
      plan: org.plan || "pro",
      status: org.status || "active",
      phone: org.phone || null,
      email: org.email || null,
      updated_at: new Date().toISOString(),
    };

    // Letterhead columns (added via add_letterhead_columns.sql migration)
    const letterheadFields: Record<string, any> = {
      letterhead_enabled: org.letterhead_enabled !== false,
      letterhead_watermark_url: org.letterhead_watermark_url || null,
      letterhead_watermark_opacity: org.letterhead_watermark_opacity ?? 0.10,
      letterhead_header_url: org.letterhead_header_url || null,
      letterhead_footer_url: org.letterhead_footer_url || null,
      letterhead_header_text: org.letterhead_header_text || null,
      letterhead_footer_text: org.letterhead_footer_text || null,
      letterhead_logo_height: org.letterhead_logo_height ?? 130,
    };

    // Extra address columns (may or may not exist depending on migrations run)
    const addressFields: Record<string, any> = {
      ie: org.ie || null,
      address_st: org.address_st || null,
      address_number: org.address_number || null,
      address_neighborhood: org.address_neighborhood || null,
      address_city: org.address_city || null,
      address_estate: org.address_estate || null,
      address_zipcode: org.address_zipcode || null,
      require_equipment_availability: org.require_equipment_availability !== false,
    };

    // Save to mock / local cache so changes are immediate
    MockDataService.saveOrganization(org);

    try {
      const persistOrganization = async (record: Record<string, any>) => {
        const { id, ...changes } = record;

        // An existing organization must be updated, not upserted. PostgreSQL
        // evaluates UPSERT as a possible INSERT, which incorrectly requires
        // tenant users to have permission to create organizations.
        const updateResult = await supabase
          .from("organizations")
          .update(changes)
          .eq("id", id)
          .select("id");

        if (updateResult.error) return updateResult;
        if ((updateResult.data || []).length > 0) return updateResult;

        const existingResult = await supabase
          .from("organizations")
          .select("id")
          .eq("id", id)
          .maybeSingle();

        if (existingResult.data) {
          throw new Error("Seu usuário não tem permissão para atualizar esta empresa.");
        }

        // This path is used only by the SuperAdmin organization-creation flow.
        return supabaseAdmin
          .from("organizations")
          .insert(record)
          .select("id");
      };

      // Attempt 1: Try with ALL columns (base + letterhead + address)
      const fullRecord = {
        ...dbRecord,
        ...letterheadFields,
        ...addressFields,
        // Optional layout field from the latest migration. Older databases do
        // not have it yet, so the compatibility retry below intentionally
        // omits only this field while preserving the watermark URL.
        letterhead_header_height: org.letterhead_header_height ?? 80,
      };
      const res = await persistOrganization(fullRecord);

      if (res.error) {
        console.warn("Full organization save failed, trying base + letterhead only:", res.error.message);
        // Attempt 2: Try with base + letterhead (without extra address columns)
        const partialRecord = { ...dbRecord, ...letterheadFields };
        const res2 = await persistOrganization(partialRecord);

        if (res2.error) {
          // Do not report success after silently discarding the watermark.
          // This normally means the letterhead migration has not been applied
          // or the current user cannot update this organization.
          throw new Error(`Não foi possível persistir o papel timbrado: ${res2.error.message}`);
        }
      }
    } catch (e) {
      console.error("Supabase saveOrganization failed:", e);
      throw e;
    }
  }

  static async deleteOrganization(id: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from("organizations").delete().eq("id", id);
      if (error) {
        const fallback = await supabase.from("organizations").delete().eq("id", id);
        if (fallback.error) throw fallback.error;
      }
    } catch (e) {
      console.error("Supabase deleteOrganization failed:", e);
      throw e;
    }
  }

  static async getProfiles(orgId?: string): Promise<UserProfile[]> {
    try {
      let query = supabase.from("profiles").select("*");
      if (orgId) {
        // Fetch profiles belonging to this organization OR profiles that don't belong to any organization (null)
        // so that new/unassigned users created in the Supabase Dashboard can be linked/managed.
        query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Supabase getProfiles error:", error);
        return [];
      }
      return (data || []) as UserProfile[];
    } catch (e) {
      console.error("Supabase getProfiles failed:", e);
      return [];
    }
  }

  static async saveProfile(profile: UserProfile): Promise<void> {
    try {
      const { error } = await supabase.from("profiles").upsert(profile);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveProfile failed:", e);
      throw e;
    }
  }

  // 1. EQUIPMENT CATALOG (MODELOS DE EQUIPAMENTOS)
  static async getEquipmentCatalog(orgId: string): Promise<EquipmentCatalog[]> {
    try {
      const { data, error } = await supabase.from("equipment_catalog").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getEquipmentCatalog error:", error);
        return [];
      }
      return (data || []) as EquipmentCatalog[];
    } catch (e) {
      console.error("Supabase getEquipmentCatalog failed:", e);
      return [];
    }
  }

  static async saveEquipmentCatalog(item: EquipmentCatalog): Promise<void> {
    try {
      const dbRecord = {
        id: item.id,
        organization_id: item.organization_id,
        name: item.name,
        category: item.category,
        brand_model: item.brand_model || null,
        size_dimension: item.size_dimension || "Padrão",
        description: item.description || null,
        images: item.images || [],
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("equipment_catalog").upsert(dbRecord);
      if (error) {
        console.warn("Supabase saveEquipmentCatalog notice, attempting admin client:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_catalog").upsert(dbRecord);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase saveEquipmentCatalog failed:", e);
      throw e;
    }
  }

  static async deleteEquipmentCatalog(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("equipment_catalog").delete().eq("id", id);
      if (error) {
        const adminRes = await supabaseAdmin.from("equipment_catalog").delete().eq("id", id);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase deleteEquipmentCatalog failed:", e);
      throw e;
    }
  }

  // 2. EQUIPMENT PRICING (TARIFAS & PREÇOS POR MODELO / TAMANHO)
  static async getEquipmentPricing(orgId: string): Promise<EquipmentPricing[]> {
    try {
      const { data, error } = await supabase.from("equipment_pricing").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getEquipmentPricing error:", error);
        return [];
      }
      return (data || []) as EquipmentPricing[];
    } catch (e) {
      console.error("Supabase getEquipmentPricing failed:", e);
      return [];
    }
  }

  static async saveEquipmentPricing(pricing: EquipmentPricing): Promise<void> {
    try {
      const dbRecord = {
        id: pricing.id,
        organization_id: pricing.organization_id,
        catalog_id: pricing.catalog_id,
        daily_rate: Number(pricing.daily_rate) || 0,
        monthly_rate: Number(pricing.monthly_rate) || 0,
        created_at: pricing.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("equipment_pricing").upsert(dbRecord);
      if (error) {
        console.warn("Supabase saveEquipmentPricing notice, trying admin:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_pricing").upsert(dbRecord);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase saveEquipmentPricing error:", e);
      throw e;
    }
  }

  // 3. EQUIPMENT ASSETS (UNIDADES FÍSICAS DE PATRIMÔNIO / FROTA)
  static async getEquipmentAssets(orgId: string): Promise<EquipmentAsset[]> {
    try {
      const catalog = await this.getEquipmentCatalog(orgId);
      const pricingList = await this.getEquipmentPricing(orgId);

      const { data, error } = await supabase.from("equipment_assets").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getEquipmentAssets error:", error);
        return [];
      }

      return (data || []).map((item: any) => ({
        ...item,
        catalog_item: catalog.find((c) => c.id === item.catalog_id),
        pricing_item: pricingList.find((p) => p.id === item.pricing_id || p.catalog_id === item.catalog_id),
      })) as EquipmentAsset[];
    } catch (e) {
      console.error("Supabase getEquipmentAssets error:", e);
      return [];
    }
  }

  static async saveEquipmentAsset(asset: EquipmentAsset): Promise<void> {
    try {
      const dbRecord = {
        id: asset.id,
        organization_id: asset.organization_id,
        catalog_id: asset.catalog_id,
        pricing_id: asset.pricing_id || null,
        code: asset.code,
        serial_number: asset.serial_number || null,
        status: asset.status || "Available",
        location_current: asset.location_current || "Pátio Central",
        created_at: asset.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("equipment_assets").upsert(dbRecord);
      if (error) {
        console.warn("Supabase saveEquipmentAsset notice, trying admin:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_assets").upsert(dbRecord);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase saveEquipmentAsset error:", e);
      throw e;
    }
  }

  // Partial update used to flip an asset's status (e.g. Available -> Rented) without
  // requiring the caller to load/re-send the full EquipmentAsset record.
  static async updateEquipmentAssetStatus(id: string, status: EquipmentStatus): Promise<void> {
    try {
      const patch = { status, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("equipment_assets").update(patch).eq("id", id);
      if (error) {
        const adminRes = await supabaseAdmin.from("equipment_assets").update(patch).eq("id", id);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase updateEquipmentAssetStatus error:", e);
      throw e;
    }
  }

  static async deleteEquipmentAsset(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("equipment_assets").delete().eq("id", id);
      if (error) {
        const adminRes = await supabaseAdmin.from("equipment_assets").delete().eq("id", id);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase deleteEquipmentAsset error:", e);
      throw e;
    }
  }

  // EQUIPMENT (FULL MODEL COMPATIBILITY FOR PROPOSALS & CONTRACTS)
  static async getEquipment(orgId: string): Promise<Equipment[]> {
    try {
      const assets = await this.getEquipmentAssets(orgId);
      return assets.map((asset) => ({
        id: asset.id,
        organization_id: asset.organization_id,
        code: asset.code,
        name: asset.catalog_item?.name || "Equipamento",
        category: asset.catalog_item?.category || "Containers",
        brand_model: asset.catalog_item?.brand_model || null,
        description: asset.catalog_item?.description || null,
        serial_number: asset.serial_number || null,
        daily_rate: asset.pricing_item?.daily_rate || 0,
        monthly_rate: asset.pricing_item?.monthly_rate || 0,
        status: asset.status || "Available",
        location_current: asset.location_current || "Pátio Central",
        images: asset.catalog_item?.images || [],
        created_at: asset.created_at,
        updated_at: asset.updated_at,
        catalog_item: asset.catalog_item,
      })) as Equipment[];
    } catch (e) {
      console.error("Supabase getEquipment failed:", e);
      return [];
    }
  }

  // MAINTENANCES
  static async getMaintenances(orgId: string): Promise<Maintenance[]> {
    try {
      const { data, error } = await supabase.from("maintenances").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getMaintenances error:", error);
        return [];
      }
      const assets = await this.getEquipmentAssets(orgId);
      return (data || []).map((m: any) => ({
        ...m,
        asset: assets.find((a) => a.id === m.asset_id),
      })) as Maintenance[];
    } catch (e) {
      console.error("Supabase getMaintenances failed:", e);
      return [];
    }
  }

  static async saveMaintenance(maintenance: Maintenance): Promise<void> {
    try {
      const { asset, ...dbRecord } = maintenance as any;
      const { error } = await supabase.from("maintenances").upsert(dbRecord);
      if (error) {
        const adminRes = await supabaseAdmin.from("maintenances").upsert(dbRecord);
        if (adminRes.error) throw adminRes.error;
      }
    } catch (e) {
      console.error("Supabase saveMaintenance failed:", e);
      throw e;
    }
  }

  // CLIENTS
  static async getClients(orgId: string): Promise<Client[]> {
    try {
      const { data, error } = await supabase.from("clients").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getClients error:", error);
        return [];
      }
      return (data || []) as Client[];
    } catch (e) {
      console.error("Supabase getClients failed:", e);
      return [];
    }
  }

  static async saveClient(client: Client): Promise<void> {
    try {
      const { error } = await supabase.from("clients").upsert(client);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveClient failed:", e);
      throw e;
    }
  }

  static async deleteClient(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase deleteClient failed:", e);
      throw e;
    }
  }

  // PROPOSALS
  static async getProposals(orgId: string): Promise<Proposal[]> {
    try {
      const { data, error } = await supabase.from("proposals").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getProposals error:", error);
        return [];
      }
      const clients = await this.getClients(orgId);

      return (data || []).map((p: any) => ({
        ...p,
        client: clients.find((c) => c.id === p.client_id),
      })) as Proposal[];
    } catch (e) {
      console.error("Supabase getProposals failed:", e);
      return [];
    }
  }

  static async saveProposal(proposal: Proposal): Promise<void> {
    try {
      const { client, ...dbRecord } = proposal as any;

      // Auto-generate sequential alphanumeric code (P + YYYY + MM + 5-digit sequence) for new proposals
      if (dbRecord.proposal_number && dbRecord.proposal_number.startsWith("PROP-")) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `P${year}${month}`;

        const { data, error: queryError } = await supabase
          .from("proposals")
          .select("proposal_number")
          .like("proposal_number", `${prefix}%`)
          .order("proposal_number", { ascending: false })
          .limit(1);

        if (queryError) throw queryError;

        let nextSeq = 1;
        if (data && data.length > 0) {
          const maxNumStr = data[0].proposal_number;
          const seqPart = maxNumStr.substring(7);
          const parsed = parseInt(seqPart, 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }
        
        dbRecord.proposal_number = `${prefix}${String(nextSeq).padStart(5, '0')}`;
        proposal.proposal_number = dbRecord.proposal_number;
      }

      const { error } = await supabase.from("proposals").upsert(dbRecord);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveProposal failed:", e);
      throw e;
    }
  }

  // CONTRACTS
  static async getContracts(orgId: string): Promise<Contract[]> {
    try {
      const { data, error } = await supabase.from("contracts").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getContracts error:", error);
        return [];
      }
      const clients = await this.getClients(orgId);
      const proposals = await this.getProposals(orgId);

      return (data || []).map((c: any) => ({
        ...c,
        client: clients.find((cli) => cli.id === c.client_id),
        proposal: proposals.find((pr) => pr.id === c.proposal_id),
      })) as Contract[];
    } catch (e) {
      console.error("Supabase getContracts failed:", e);
      return [];
    }
  }

  static async saveContract(contract: Contract): Promise<void> {
    try {
      const { client, proposal, ...dbRecord } = contract as any;

      // Auto-generate sequential alphanumeric code (C + YYYY + MM + 5-digit sequence) for new contracts
      if (dbRecord.contract_number && dbRecord.contract_number.startsWith("CONT-")) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `C${year}${month}`;

        const { data, error: queryError } = await supabase
          .from("contracts")
          .select("contract_number")
          .like("contract_number", `${prefix}%`)
          .order("contract_number", { ascending: false })
          .limit(1);

        if (queryError) throw queryError;

        let nextSeq = 1;
        if (data && data.length > 0) {
          const maxNumStr = data[0].contract_number;
          const seqPart = maxNumStr.substring(7);
          const parsed = parseInt(seqPart, 10);
          if (!isNaN(parsed)) {
            nextSeq = parsed + 1;
          }
        }

        dbRecord.contract_number = `${prefix}${String(nextSeq).padStart(5, '0')}`;
        contract.contract_number = dbRecord.contract_number;
      }

      const { error } = await supabase.from("contracts").upsert(dbRecord);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveContract failed:", e);
      throw e;
    }
  }

  // FINANCIAL RECORDS
  static async getFinancialRecords(orgId: string): Promise<FinancialRecord[]> {
    try {
      const { data, error } = await supabase.from("financial_records").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getFinancialRecords error:", error);
        return [];
      }
      const clients = await this.getClients(orgId);
      const contracts = await this.getContracts(orgId);

      return (data || []).map((f: any) => ({
        ...f,
        client: clients.find((c) => c.id === f.client_id),
        contract: contracts.find((ct) => ct.id === f.contract_id),
      })) as FinancialRecord[];
    } catch (e) {
      console.error("Supabase getFinancialRecords failed:", e);
      return [];
    }
  }

  static async saveFinancialRecord(record: FinancialRecord): Promise<void> {
    try {
      const { client, contract, ...dbRecord } = record as any;
      const { error } = await supabase.from("financial_records").upsert(dbRecord);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveFinancialRecord failed:", e);
      throw e;
    }
  }

  // SERVICE ORDERS
  static async getServiceOrders(orgId: string): Promise<ServiceOrder[]> {
    try {
      const { data, error } = await supabase.from("service_orders").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getServiceOrders error:", error);
        return [];
      }
      const clients = await this.getClients(orgId);
      const contracts = await this.getContracts(orgId);
      const profiles = await this.getProfiles(orgId);

      return (data || []).map((os: any) => ({
        ...os,
        client: clients.find((c) => c.id === os.client_id),
        contract: contracts.find((ct) => ct.id === os.contract_id),
        driver: profiles.find((p) => p.id === os.driver_id),
      })) as ServiceOrder[];
    } catch (e) {
      console.error("Supabase getServiceOrders failed:", e);
      return [];
    }
  }

  static async saveServiceOrder(os: ServiceOrder): Promise<void> {
    try {
      const { client, contract, driver, ...dbRecord } = os as any;
      const { error } = await supabase.from("service_orders").upsert(dbRecord);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase saveServiceOrder failed:", e);
      throw e;
    }
  }

  // PRICING TIER RULES
  static async getPricingTierRules(orgId: string, catalogId?: string): Promise<PricingTierRule[]> {
    try {
      let query = supabase.from("pricing_tier_rules").select("*").eq("organization_id", orgId);
      if (catalogId) {
        query = query.eq("catalog_id", catalogId);
      }
      const { data, error } = await query;
      const mockRules = MockDataService.getPricingTierRules(orgId, catalogId);
      if (error) {
        console.warn("Supabase getPricingTierRules notice, using mock/local rules:", error.message);
        return mockRules;
      }
      if (!data || data.length === 0) {
        return mockRules;
      }
      return data as PricingTierRule[];
    } catch (e) {
      console.warn("Supabase getPricingTierRules failed, using mock rules:", e);
      return MockDataService.getPricingTierRules(orgId, catalogId);
    }
  }

  static async savePricingTierRule(rule: PricingTierRule): Promise<void> {
    MockDataService.savePricingTierRule(rule);
    try {
      let { error } = await supabase.from("pricing_tier_rules").upsert(rule);
      if (error) {
        const adminRes = await supabaseAdmin.from("pricing_tier_rules").upsert(rule);
        if (adminRes.error) {
          console.warn("Supabase savePricingTierRule admin notice:", adminRes.error.message);
        }
      }
    } catch (e) {
      console.warn("Supabase savePricingTierRule warning:", e);
    }
  }

  static async deletePricingTierRule(id: string): Promise<void> {
    MockDataService.deletePricingTierRule(id);
    try {
      let { error } = await supabase.from("pricing_tier_rules").delete().eq("id", id);
      if (error) {
        await supabaseAdmin.from("pricing_tier_rules").delete().eq("id", id);
      }
    } catch (e) {
      console.warn("Supabase deletePricingTierRule warning:", e);
    }
  }
}

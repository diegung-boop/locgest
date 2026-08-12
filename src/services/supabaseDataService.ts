import { supabase, supabaseAdmin } from "@/integrations/supabase/client";
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
  EquipmentAsset
} from "@/types/locgest";
import { MockDataService } from "./mockDataService";

export class SupabaseDataService {
  // ORGANIZATIONS
  static async getOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase.from("organizations").select("*");
      if (error) {
        console.error("Supabase getOrganizations error:", error);
        return MockDataService.getOrganizations();
      }
      return data as Organization[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock organizations:", e);
      return MockDataService.getOrganizations();
    }
  }

  static async saveOrganization(org: Organization): Promise<void> {
    MockDataService.saveOrganization(org);
    try {
      const { error } = await supabaseAdmin.from("organizations").upsert(org);
      if (error) {
        console.error("Supabase saveOrganization admin error:", error);
        const fallback = await supabase.from("organizations").upsert(org);
        if (fallback.error) throw fallback.error;
      }
    } catch (e) {
      console.error("Supabase upsert failed for organization:", e);
      throw e;
    }
  }

  static async deleteOrganization(id: string): Promise<void> {
    MockDataService.deleteOrganization(id);
    try {
      const { error } = await supabaseAdmin.from("organizations").delete().eq("id", id);
      if (error) {
        console.error("Supabase deleteOrganization error:", error);
        throw error;
      }
    } catch (e) {
      console.error("Supabase delete failed for organization:", e);
      throw e;
    }
  }

  // PROFILES
  static async getProfiles(orgId?: string): Promise<UserProfile[]> {
    try {
      let query = supabase.from("profiles").select("*");
      if (orgId) query = query.eq("organization_id", orgId);
      const { data, error } = await query;
      if (error) {
        console.error("Supabase getProfiles error:", error);
        return MockDataService.getProfiles(orgId);
      }
      return data as UserProfile[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock profiles:", e);
      return MockDataService.getProfiles(orgId);
    }
  }

  static async saveProfile(profile: UserProfile): Promise<void> {
    MockDataService.saveProfile(profile);
    try {
      await supabase.from("profiles").upsert(profile);
    } catch (e) {
      console.warn("Supabase upsert warning for profile:", e);
    }
  }

  // 1. EQUIPMENT CATALOG (MODELOS DE EQUIPAMENTOS)
  static async getEquipmentCatalog(orgId: string): Promise<EquipmentCatalog[]> {
    try {
      const { data, error } = await supabase.from("equipment_catalog").select("*").eq("organization_id", orgId);
      if (!error && data && data.length > 0) {
        return data as EquipmentCatalog[];
      }
      
      // Fallback to equipment table
      const { data: eqData } = await supabase.from("equipment").select("*").eq("organization_id", orgId);
      if (eqData && eqData.length > 0) {
        return eqData.map((item: any) => ({
          id: item.id,
          organization_id: item.organization_id,
          name: item.name,
          category: item.category,
          brand_model: item.brand_model || null,
          description: item.specifications?.description || item.description || null,
          images: item.images || [],
          created_at: item.created_at,
          updated_at: item.updated_at,
        })) as EquipmentCatalog[];
      }
      return MockDataService.getCatalog(orgId);
    } catch (e) {
      console.warn("Supabase getEquipmentCatalog warning, using mock:", e);
      return MockDataService.getCatalog(orgId);
    }
  }

  static async saveEquipmentCatalog(item: EquipmentCatalog): Promise<void> {
    MockDataService.saveCatalog(item);
    try {
      // 1. Write to segregated equipment_catalog table using primary client
      const { error } = await supabase.from("equipment_catalog").upsert(item);
      if (error) {
        console.warn("Supabase saveEquipmentCatalog notice, attempting admin client:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_catalog").upsert(item);
        if (adminRes.error) throw adminRes.error;
      }

      // 2. Dual-write to public.equipment for backward compatibility
      const legacyRecord = {
        id: item.id,
        organization_id: item.organization_id,
        code: `MOD-${item.name.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "")}`,
        name: item.name,
        category: item.category,
        brand_model: item.brand_model || null,
        specifications: {
          description: item.description || "",
        },
        images: item.images || [],
        updated_at: new Date().toISOString(),
      };
      await supabase.from("equipment").upsert(legacyRecord);
    } catch (e) {
      console.error("Supabase saveEquipmentCatalog failed:", e);
      throw e;
    }
  }

  // 2. EQUIPMENT PRICING (TARIFAS & PREÇOS POR MODELO / TAMANHO)
  static async getEquipmentPricing(orgId: string): Promise<EquipmentPricing[]> {
    try {
      const { data, error } = await supabase.from("equipment_pricing").select("*").eq("organization_id", orgId);
      if (!error && data && data.length > 0) {
        return data as EquipmentPricing[];
      }

      // Fallback from public.equipment table
      const catalog = await this.getEquipmentCatalog(orgId);
      const { data: eqData } = await supabase.from("equipment").select("*").eq("organization_id", orgId);
      if (eqData && eqData.length > 0) {
        return eqData.map((item: any) => ({
          id: `price-${item.id}`,
          organization_id: item.organization_id,
          catalog_id: item.id,
          size_dimension: item.specifications?.size_dimension || item.size_dimension || "Padrão",
          daily_rate: Number(item.daily_rate) || 0,
          monthly_rate: Number(item.monthly_rate) || 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          catalog_item: catalog.find((c) => c.id === item.id),
        })) as EquipmentPricing[];
      }
      return [];
    } catch (e) {
      console.warn("Supabase getEquipmentPricing warning:", e);
      return [];
    }
  }

  static async saveEquipmentPricing(pricing: EquipmentPricing): Promise<void> {
    try {
      // 1. Write to segregated equipment_pricing table
      const { error } = await supabase.from("equipment_pricing").upsert(pricing);
      if (error) {
        console.warn("Supabase saveEquipmentPricing notice, trying admin:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_pricing").upsert(pricing);
        if (adminRes.error) throw adminRes.error;
      }

      // 2. Dual-write to public.equipment for backward compatibility
      const legacyUpdate = {
        id: pricing.catalog_id,
        organization_id: pricing.organization_id,
        daily_rate: Number(pricing.daily_rate) || 0,
        monthly_rate: Number(pricing.monthly_rate) || 0,
        specifications: {
          size_dimension: pricing.size_dimension || "Padrão",
        },
        updated_at: new Date().toISOString(),
      };
      await supabase.from("equipment").upsert(legacyUpdate);
    } catch (e) {
      console.error("Supabase saveEquipmentPricing error:", e);
      throw e;
    }
  }

  // 3. EQUIPMENT ASSETS (PATRIMÔNIO FÍSICO / FROTA)
  static async getEquipmentAssets(orgId: string): Promise<EquipmentAsset[]> {
    try {
      const catalog = await this.getEquipmentCatalog(orgId);
      const pricingList = await this.getEquipmentPricing(orgId);

      const { data, error } = await supabase.from("equipment_assets").select("*").eq("organization_id", orgId);
      if (!error && data && data.length > 0) {
        return data.map((item: any) => ({
          ...item,
          catalog_item: catalog.find((c) => c.id === item.catalog_id),
          pricing_item: pricingList.find((p) => p.id === item.pricing_id || p.catalog_id === item.catalog_id),
        })) as EquipmentAsset[];
      }

      // Fallback from public.equipment table
      const { data: eqData } = await supabase.from("equipment").select("*").eq("organization_id", orgId);
      if (eqData && eqData.length > 0) {
        return eqData.map((item: any) => {
          const catItem = catalog.find((c) => c.id === item.id) || {
            id: item.id,
            organization_id: item.organization_id,
            name: item.name,
            category: item.category,
            brand_model: item.brand_model,
            description: item.description,
            created_at: item.created_at,
            updated_at: item.updated_at,
          };
          const prcItem: EquipmentPricing = pricingList.find((p) => p.catalog_id === item.id) || {
            id: `price-${item.id}`,
            organization_id: item.organization_id,
            catalog_id: item.id,
            size_dimension: item.specifications?.size_dimension || "Padrão",
            daily_rate: Number(item.daily_rate) || 0,
            monthly_rate: Number(item.monthly_rate) || 0,
            created_at: item.created_at,
            updated_at: item.updated_at,
          };

          return {
            id: item.id,
            organization_id: item.organization_id,
            catalog_id: item.id,
            pricing_id: prcItem.id,
            code: item.code || "EQ-001",
            serial_number: item.serial_number || null,
            status: item.status || "Available",
            location_current: item.location_current || "Pátio Central",
            created_at: item.created_at,
            updated_at: item.updated_at,
            catalog_item: catItem,
            pricing_item: prcItem,
          };
        }) as EquipmentAsset[];
      }

      return MockDataService.getAssets(orgId);
    } catch (e) {
      console.error("Supabase getEquipmentAssets error:", e);
      return MockDataService.getAssets(orgId);
    }
  }

  static async saveEquipmentAsset(asset: EquipmentAsset): Promise<void> {
    MockDataService.saveAsset(asset);
    try {
      const { catalog_item, pricing_item, ...dbRecord } = asset as any;

      // 1. Write to segregated equipment_assets table
      const { error } = await supabase.from("equipment_assets").upsert(dbRecord);
      if (error) {
        console.warn("Supabase saveEquipmentAsset notice, trying admin:", error.message);
        const adminRes = await supabaseAdmin.from("equipment_assets").upsert(dbRecord);
        if (adminRes.error) throw adminRes.error;
      }

      // 2. Dual-write to public.equipment
      const legacyRecord = {
        id: asset.id,
        organization_id: asset.organization_id,
        code: asset.code,
        name: asset.catalog_item?.name || "Equipamento",
        category: asset.catalog_item?.category || "Containers",
        brand_model: asset.catalog_item?.brand_model || null,
        serial_number: asset.serial_number || null,
        daily_rate: Number(asset.pricing_item?.daily_rate) || 0,
        monthly_rate: Number(asset.pricing_item?.monthly_rate) || 0,
        status: asset.status,
        location_current: asset.location_current,
        updated_at: new Date().toISOString(),
      };
      await supabase.from("equipment").upsert(legacyRecord);
    } catch (e) {
      console.error("Supabase saveEquipmentAsset error:", e);
      throw e;
    }
  }

  // EQUIPMENT (FULL MODEL COMPATIBILITY)
  static async getEquipment(orgId: string): Promise<Equipment[]> {
    try {
      const { data, error } = await supabase.from("equipment").select("*").eq("organization_id", orgId);
      if (error || !data || data.length === 0) {
        return MockDataService.getEquipment(orgId);
      }
      return data.map((item: any) => ({
        id: item.id,
        organization_id: item.organization_id,
        code: item.code,
        name: item.name,
        category: item.category,
        brand_model: item.brand_model || "",
        description: item.specifications?.description || "",
        serial_number: item.serial_number || null,
        daily_rate: Number(item.daily_rate) || 0,
        monthly_rate: Number(item.monthly_rate) || 0,
        status: item.status || "Available",
        location_current: item.location_current || "Pátio Central",
        images: item.images || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        catalog_item: {
          id: item.id,
          organization_id: item.organization_id,
          name: item.name,
          category: item.category,
          brand_model: item.brand_model,
          size_dimension: item.specifications?.size_dimension || "Padrão",
          daily_rate: Number(item.daily_rate) || 0,
          monthly_rate: Number(item.monthly_rate) || 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
        },
      })) as Equipment[];
    } catch (e) {
      return MockDataService.getEquipment(orgId);
    }
  }

  static async saveEquipment(equipment: Equipment): Promise<void> {
    MockDataService.saveEquipment(equipment);
    try {
      const { catalog_item, ...dbRecord } = equipment as any;
      const { error } = await supabaseAdmin.from("equipment").upsert(dbRecord);
      if (error) {
        const fb = await supabase.from("equipment").upsert(dbRecord);
        if (fb.error) throw fb.error;
      }
    } catch (e) {
      console.error("Supabase saveEquipment warning:", e);
      throw e;
    }
  }

  // CLIENTS
  static async getClients(orgId: string): Promise<Client[]> {
    try {
      const { data, error } = await supabase.from("clients").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getClients error:", error);
        return MockDataService.getClients(orgId);
      }
      return (data || []) as Client[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock clients:", e);
      return MockDataService.getClients(orgId);
    }
  }

  static async saveClient(client: Client): Promise<void> {
    MockDataService.saveClient(client);
    try {
      await supabase.from("clients").upsert(client);
    } catch (e) {
      console.warn("Supabase upsert warning for client:", e);
    }
  }

  static async deleteClient(id: string): Promise<void> {
    MockDataService.deleteClient(id);
    try {
      await supabase.from("clients").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase delete warning for client:", e);
    }
  }

  // PROPOSALS
  static async getProposals(orgId: string): Promise<Proposal[]> {
    try {
      const { data, error } = await supabase.from("proposals").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getProposals error:", error);
        return MockDataService.getProposals(orgId);
      }
      const clients = await this.getClients(orgId);

      const dbList = (data || []).map((p: any) => ({
        ...p,
        client: clients.find((c) => c.id === p.client_id),
      }));

      return dbList as Proposal[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock proposals:", e);
      return MockDataService.getProposals(orgId);
    }
  }

  static async saveProposal(proposal: Proposal): Promise<void> {
    MockDataService.saveProposal(proposal);
    try {
      const { client, ...dbRecord } = proposal as any;
      const { error } = await supabase.from("proposals").upsert(dbRecord);
      if (error) console.error("Supabase upsert error for proposal:", error.message);
    } catch (e) {
      console.warn("Supabase upsert warning for proposal:", e);
    }
  }

  // CONTRACTS
  static async getContracts(orgId: string): Promise<Contract[]> {
    try {
      const { data, error } = await supabase.from("contracts").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getContracts error:", error);
        return MockDataService.getContracts(orgId);
      }
      const clients = await this.getClients(orgId);
      const proposals = await this.getProposals(orgId);

      const dbList = (data || []).map((c: any) => ({
        ...c,
        client: clients.find((cli) => cli.id === c.client_id),
        proposal: proposals.find((pr) => pr.id === c.proposal_id),
      }));

      return dbList as Contract[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock contracts:", e);
      return MockDataService.getContracts(orgId);
    }
  }

  static async saveContract(contract: Contract): Promise<void> {
    MockDataService.saveContract(contract);
    try {
      const { client, proposal, ...dbRecord } = contract as any;
      const { error } = await supabase.from("contracts").upsert(dbRecord);
      if (error) console.error("Supabase upsert error for contract:", error.message);
    } catch (e) {
      console.warn("Supabase upsert warning for contract:", e);
    }
  }

  // FINANCIAL RECORDS
  static async getFinancialRecords(orgId: string): Promise<FinancialRecord[]> {
    try {
      const { data, error } = await supabase.from("financial_records").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getFinancialRecords error:", error);
        return MockDataService.getFinancialRecords(orgId);
      }
      const clients = await this.getClients(orgId);
      const contracts = await this.getContracts(orgId);

      const dbList = (data || []).map((f: any) => ({
        ...f,
        client: clients.find((c) => c.id === f.client_id),
        contract: contracts.find((ct) => ct.id === f.contract_id),
      }));

      return dbList as FinancialRecord[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock financial records:", e);
      return MockDataService.getFinancialRecords(orgId);
    }
  }

  static async saveFinancialRecord(record: FinancialRecord): Promise<void> {
    MockDataService.saveFinancialRecord(record);
    try {
      const { client, contract, ...dbRecord } = record as any;
      const { error } = await supabase.from("financial_records").upsert(dbRecord);
      if (error) console.error("Supabase upsert error for financial_record:", error.message);
    } catch (e) {
      console.warn("Supabase upsert warning for financial_record:", e);
    }
  }

  // SERVICE ORDERS
  static async getServiceOrders(orgId: string): Promise<ServiceOrder[]> {
    try {
      const { data, error } = await supabase.from("service_orders").select("*").eq("organization_id", orgId);
      if (error) {
        console.error("Supabase getServiceOrders error:", error);
        return MockDataService.getServiceOrders(orgId);
      }
      const clients = await this.getClients(orgId);
      const contracts = await this.getContracts(orgId);
      const profiles = await this.getProfiles(orgId);

      const dbList = (data || []).map((os: any) => ({
        ...os,
        client: clients.find((c) => c.id === os.client_id),
        contract: contracts.find((ct) => ct.id === os.contract_id),
        driver: profiles.find((p) => p.id === os.driver_id),
      }));

      return dbList as ServiceOrder[];
    } catch (e) {
      console.warn("Supabase unavailable, falling back to mock service orders:", e);
      return MockDataService.getServiceOrders(orgId);
    }
  }

  static async saveServiceOrder(os: ServiceOrder): Promise<void> {
    MockDataService.saveServiceOrder(os);
    try {
      const { client, contract, driver, ...dbRecord } = os as any;
      const { error } = await supabase.from("service_orders").upsert(dbRecord);
      if (error) console.error("Supabase upsert error for service_order:", error.message);
    } catch (e) {
      console.warn("Supabase upsert warning for service_order:", e);
    }
  }
}

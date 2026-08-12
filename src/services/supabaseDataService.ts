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
  EquipmentPricing,
  EquipmentAsset
} from "@/types/locgest";

export class SupabaseDataService {
  // ORGANIZATIONS
  static async getOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase.from("organizations").select("*");
      if (error) {
        console.error("Supabase getOrganizations error:", error);
        return [];
      }
      return (data || []) as Organization[];
    } catch (e) {
      console.error("Supabase getOrganizations failed:", e);
      return [];
    }
  }

  static async saveOrganization(org: Organization): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from("organizations").upsert(org);
      if (error) {
        const fallback = await supabase.from("organizations").upsert(org);
        if (fallback.error) throw fallback.error;
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

  // PROFILES
  static async getProfiles(orgId?: string): Promise<UserProfile[]> {
    try {
      let query = supabase.from("profiles").select("*");
      if (orgId) query = query.eq("organization_id", orgId);
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
      const { error } = await supabase.from("equipment_catalog").upsert(item);
      if (error) {
        const adminRes = await supabaseAdmin.from("equipment_catalog").upsert(item);
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
        size_dimension: pricing.size_dimension || "Padrão",
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
}

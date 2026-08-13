import { 
  Organization, 
  UserProfile, 
  Equipment, 
  EquipmentCatalog,
  EquipmentAsset,
  Client, 
  Proposal, 
  Contract, 
  FinancialRecord, 
  ServiceOrder 
} from "@/types/locgest";

const STORAGE_KEYS = {
  ORGANIZATIONS: "locgest_organizations",
  PROFILES: "locgest_profiles",
  CATALOG: "locgest_catalog",
  ASSETS: "locgest_assets",
  EQUIPMENT: "locgest_equipment",
  CLIENTS: "locgest_clients",
  PROPOSALS: "locgest_proposals",
  CONTRACTS: "locgest_contracts",
  FINANCIAL: "locgest_financial",
  SERVICE_ORDERS: "locgest_service_orders",
};

// Clean Base System with SuperAdmin Tenant
const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    name: "Locadora Matriz (SuperAdmin)",
    slug: "matriz",
    trade_name: "Locadora Matriz",
    cnpj: "00.000.000/0001-00",
    logo_url: null,
    primary_color: "#0284c7", // Sky blue
    plan: "Enterprise",
    status: "active",
    phone: "(11) 3000-0000",
    email: "superadmin@locgest.com.br",
    address_st: "São Paulo, SP",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_PROFILES: UserProfile[] = [
  {
    id: "72078b6a-c990-4b81-9aa7-c93539570e33",
    organization_id: "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
    email: "superadmin@locgest.com.br",
    full_name: "Carlos Andrade (SuperAdmin)",
    role: "Admin",
    is_super_admin: true,
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    phone: "(11) 99999-8888",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_EQUIPMENT: Equipment[] = [];
const INITIAL_CLIENTS: Client[] = [];
const INITIAL_PROPOSALS: Proposal[] = [];
const INITIAL_CONTRACTS: Contract[] = [];
const INITIAL_FINANCIAL: FinancialRecord[] = [];
const INITIAL_SERVICE_ORDERS: ServiceOrder[] = [];

// Helper Functions for LocalStorage state
function getItem<T>(key: string, defaultVal: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Error setting localStorage key", key, e);
  }
}

export class MockDataService {
  // ORGANIZATIONS
  static getOrganizations(): Organization[] {
    return getItem(STORAGE_KEYS.ORGANIZATIONS, INITIAL_ORGANIZATIONS);
  }
  static saveOrganization(org: Organization): void {
    const list = this.getOrganizations();
    const idx = list.findIndex((o) => o.id === org.id);
    if (idx >= 0) list[idx] = org;
    else list.push(org);
    setItem(STORAGE_KEYS.ORGANIZATIONS, list);
  }
  static deleteOrganization(id: string): void {
    const list = this.getOrganizations();
    const filtered = list.filter((o) => o.id !== id);
    setItem(STORAGE_KEYS.ORGANIZATIONS, filtered);
  }

  // PROFILES
  static getProfiles(orgId?: string): UserProfile[] {
    const all = getItem(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    return orgId ? all.filter((p) => p.organization_id === orgId) : all;
  }
  static saveProfile(profile: UserProfile): void {
    const list = getItem(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) list[idx] = profile;
    else list.push(profile);
    setItem(STORAGE_KEYS.PROFILES, list);
  }

  // EQUIPMENT
  static getEquipment(orgId: string): Equipment[] {
    const all = getItem(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    return all.filter((e) => e.organization_id === orgId);
  }
  static saveEquipment(item: Equipment): void {
    const list = getItem(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    const idx = list.findIndex((e) => e.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    setItem(STORAGE_KEYS.EQUIPMENT, list);
  }

  // CLIENTS
  static getClients(orgId: string): Client[] {
    const all = getItem(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    return all.filter((c) => c.organization_id === orgId);
  }
  static saveClient(client: Client): void {
    const list = getItem(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    const idx = list.findIndex((c) => c.id === client.id);
    if (idx >= 0) list[idx] = client;
    else list.push(client);
    setItem(STORAGE_KEYS.CLIENTS, list);
  }
  static deleteClient(id: string): void {
    const list = getItem(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    const filtered = list.filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.CLIENTS, filtered);
  }

  // PROPOSALS
  static getProposals(orgId: string): Proposal[] {
    const proposals = getItem(STORAGE_KEYS.PROPOSALS, INITIAL_PROPOSALS);
    const clients = this.getClients(orgId);
    return proposals
      .filter((p) => p.organization_id === orgId)
      .map((p) => ({
        ...p,
        client: clients.find((c) => c.id === p.client_id),
      }));
  }
  static saveProposal(prop: Proposal): void {
    const list = getItem(STORAGE_KEYS.PROPOSALS, INITIAL_PROPOSALS);
    const idx = list.findIndex((p) => p.id === prop.id);
    if (idx >= 0) list[idx] = prop;
    else list.push(prop);
    setItem(STORAGE_KEYS.PROPOSALS, list);
  }

  // CONTRACTS
  static getContracts(orgId: string): Contract[] {
    const contracts = getItem(STORAGE_KEYS.CONTRACTS, INITIAL_CONTRACTS);
    const clients = this.getClients(orgId);
    const proposals = this.getProposals(orgId);
    return contracts
      .filter((c) => c.organization_id === orgId)
      .map((c) => ({
        ...c,
        client: clients.find((cli) => cli.id === c.client_id),
        proposal: proposals.find((pr) => pr.id === c.proposal_id),
      }));
  }
  static saveContract(contract: Contract): void {
    const list = getItem(STORAGE_KEYS.CONTRACTS, INITIAL_CONTRACTS);
    const idx = list.findIndex((c) => c.id === contract.id);
    if (idx >= 0) list[idx] = contract;
    else list.push(contract);
    setItem(STORAGE_KEYS.CONTRACTS, list);
  }

  // FINANCIAL
  static getFinancialRecords(orgId: string): FinancialRecord[] {
    const records = getItem(STORAGE_KEYS.FINANCIAL, INITIAL_FINANCIAL);
    const clients = this.getClients(orgId);
    const contracts = this.getContracts(orgId);
    return records
      .filter((r) => r.organization_id === orgId)
      .map((r) => ({
        ...r,
        client: clients.find((c) => c.id === r.client_id),
        contract: contracts.find((ct) => ct.id === r.contract_id),
      }));
  }
  static saveFinancialRecord(rec: FinancialRecord): void {
    const list = getItem(STORAGE_KEYS.FINANCIAL, INITIAL_FINANCIAL);
    const idx = list.findIndex((r) => r.id === rec.id);
    if (idx >= 0) list[idx] = rec;
    else list.push(rec);
    setItem(STORAGE_KEYS.FINANCIAL, list);
  }

  // SERVICE ORDERS (LOGÍSTICA / OS)
  static getServiceOrders(orgId: string): ServiceOrder[] {
    const osList = getItem(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    const clients = this.getClients(orgId);
    const contracts = this.getContracts(orgId);
    const profiles = this.getProfiles(orgId);
    return osList
      .filter((os) => os.organization_id === orgId)
      .map((os) => ({
        ...os,
        client: clients.find((c) => c.id === os.client_id),
        contract: contracts.find((ct) => ct.id === os.contract_id),
        driver: profiles.find((p) => p.id === os.driver_id),
      }));
  }
  static saveServiceOrder(os: ServiceOrder): void {
    const list = getItem(STORAGE_KEYS.SERVICE_ORDERS, INITIAL_SERVICE_ORDERS);
    const idx = list.findIndex((o) => o.id === os.id);
    if (idx >= 0) list[idx] = os;
    else list.push(os);
    setItem(STORAGE_KEYS.SERVICE_ORDERS, list);
  }

  // CATALOG
  static getCatalog(orgId: string): EquipmentCatalog[] {
    const list = getItem<EquipmentCatalog[]>(STORAGE_KEYS.CATALOG, []);
    return list.filter((c) => c.organization_id === orgId);
  }

  static saveCatalog(item: EquipmentCatalog): void {
    const list = getItem<EquipmentCatalog[]>(STORAGE_KEYS.CATALOG, []);
    const idx = list.findIndex((c) => c.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    setItem(STORAGE_KEYS.CATALOG, list);
  }

  // ASSETS (PATRIMÔNIO FÍSICO)
  static getAssets(orgId: string): EquipmentAsset[] {
    const list = getItem<EquipmentAsset[]>(STORAGE_KEYS.ASSETS, []);
    const catalog = this.getCatalog(orgId);
    return list
      .filter((a) => a.organization_id === orgId)
      .map((a) => ({
        ...a,
        catalog_item: catalog.find((c) => c.id === a.catalog_id),
      }));
  }

  static saveAsset(asset: EquipmentAsset): void {
    const list = getItem<EquipmentAsset[]>(STORAGE_KEYS.ASSETS, []);
    const cleanAsset = { ...asset };
    delete cleanAsset.catalog_item;
    const idx = list.findIndex((a) => a.id === cleanAsset.id);
    if (idx >= 0) list[idx] = cleanAsset;
    else list.push(cleanAsset);
    setItem(STORAGE_KEYS.ASSETS, list);
  }
}

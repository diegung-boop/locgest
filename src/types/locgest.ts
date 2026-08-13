export type UserRole = 
  | "Admin" 
  | "Diretor" 
  | "Gestor" 
  | "Analista" 
  | "Entregador" 
  | "Cliente";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  trade_name?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  logo_url?: string | null;
  primary_color: string;
  plan: string;
  status: "active" | "suspended" | "trial";
  phone?: string | null;
  email?: string | null;
  address_st?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_estate?: string | null;
  address_zipcode?: string | null;
  // Whether proposal creation restricts equipment selection to what the
  // availability rule (status + contract/maintenance date check) allows.
  // Defaults to true (rule enforced) — see CreateProposalModal.isEquipmentAvailable.
  require_equipment_availability: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  organization_id?: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_super_admin: boolean;
  avatar_url?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
}

export type EquipmentStatus = "Available" | "Rented" | "Maintenance" | "InTransit" | "Reserved" | "Interno";

export interface EquipmentCatalog {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  brand_model?: string | null;
  size_dimension: string; // ex: "20 Pés (6m)", "40 Pés (12m)"
  description?: string | null;
  images?: string[];
  created_at: string;
  updated_at: string;
}

export interface EquipmentPricing {
  id: string;
  organization_id: string;
  catalog_id: string;
  catalog_item?: EquipmentCatalog;
  daily_rate: number;
  monthly_rate: number;
  created_at: string;
  updated_at: string;
}

export interface EquipmentAsset {
  id: string;
  organization_id: string;
  catalog_id: string;
  pricing_id?: string | null;
  catalog_item?: EquipmentCatalog;
  pricing_item?: EquipmentPricing;
  code: string; // Patrimônio (TAG ex: CONT-001)
  serial_number?: string | null;
  status: EquipmentStatus;
  location_current: string;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  organization_id: string;
  code: string; // Patrimônio (TAG)
  name: string;
  category: string;
  brand_model?: string | null;
  description?: string | null;
  size_dimension?: string | null;
  serial_number?: string | null;
  daily_rate: number;
  monthly_rate: number;
  status: EquipmentStatus;
  location_current: string;
  catalog_id?: string;
  pricing_id?: string;
  images?: string[];
  created_at: string;
  updated_at: string;
  catalog_item?: EquipmentCatalog;
}

export interface Maintenance {
  id: string;
  organization_id: string;
  asset_id: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  status: "Scheduled" | "InProgress" | "Completed";
  created_at?: string;
  updated_at?: string;
  asset?: EquipmentAsset;
}


export interface Client {
  id: string;
  organization_id: string;
  company_name: string; // Razão Social
  trade_name?: string | null; // Nome Fantasia
  cnpj_cpf: string;
  email: string;
  phone?: string | null;
  contact_person?: string | null;
  ie?: string | null;
  billing_address?: string | null;
  default_job_site?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalItem {
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  daily_rate: number;
  monthly_rate: number;
  qty: number;
  billing_type: "daily" | "monthly";
  duration_months?: number;
  early_return_date?: string;
  total_amount: number;
}

export type ProposalStatus = "Draft" | "Sent" | "Approved" | "Rejected" | "Cancelled";

export interface Proposal {
  id: string;
  organization_id: string;
  client_id: string;
  client?: Client;
  proposal_number: string; // e.g. PROP-2026-089
  status: ProposalStatus;
  job_site_name: string;
  job_site_address: string;
  start_date: string;
  end_date: string;
  requested_delivery_date: string;
  equipment_items: ProposalItem[];
  total_amount: number;
  pdf_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractStatus = "Draft" | "PendingSignature" | "Active" | "Finished" | "Terminated";

export interface Contract {
  id: string;
  organization_id: string;
  client_id: string;
  proposal_id?: string | null;
  client?: Client;
  proposal?: Proposal;
  contract_number: string; // e.g. CONT-2026-042
  status: ContractStatus;
  total_value: number;
  billing_cycle: "Daily" | "Weekly" | "Fortnightly" | "Monthly";
  start_date: string;
  end_date: string;
  terms_conditions?: string | null;
  signed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type FinancialRecordType = "nf_service" | "nf_remessa" | "boleto";
export type FinancialRecordStatus = "Pending" | "Paid" | "Overdue" | "Cancelled";

export interface FinancialRecord {
  id: string;
  organization_id: string;
  contract_id: string;
  client_id: string;
  contract?: Contract;
  client?: Client;
  type: FinancialRecordType;
  code_number: string; // e.g. NFE-88123 / BOL-99412
  description?: string | null;
  amount: number;
  due_date: string;
  status: FinancialRecordStatus;
  payment_proof_url?: string | null;
  paid_at?: string | null;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceOrderType = "Delivery" | "Pickup" | "Maintenance";
export type ServiceOrderStatus = "Pending" | "InRoute" | "Completed" | "Cancelled";

export interface ServiceOrder {
  id: string;
  organization_id: string;
  contract_id: string;
  client_id: string;
  driver_id?: string | null;
  contract?: Contract;
  client?: Client;
  driver?: UserProfile;
  os_number: string; // e.g. OS-2026-104
  type: ServiceOrderType;
  status: ServiceOrderStatus;
  scheduled_date: string;
  job_site_address: string;
  delivered_at?: string | null;
  notes?: string | null;
  
  // Field evidencias
  photos?: string[];
  geo_latitude?: number | null;
  geo_longitude?: number | null;
  geo_timestamp?: string | null;
  receiver_name?: string | null;
  receiver_document?: string | null;

  created_at: string;
  updated_at: string;
}

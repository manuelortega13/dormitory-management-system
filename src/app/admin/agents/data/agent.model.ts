export interface Agent {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer';
  dean_type: 'male' | 'female' | null;
  phone: string | null;
  photo_url: string | null;
  status: 'active' | 'suspended';
  suspension_reason: string | null;
  suspended_at: string | null;
  created_at: string;
}

export interface CreateAgentDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer';
  deanType?: 'male' | 'female';
  phone?: string;
}

export interface AgentFilters {
  role?: 'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer';
  status?: 'active' | 'suspended';
  search?: string;
}

export interface UpdateAgentDto {
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas' | 'business_officer';
  deanType?: 'male' | 'female';
  phone?: string;
}

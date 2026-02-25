export interface Agent {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas';
  dean_type: 'male' | 'female' | null;
  phone: string | null;
  photo_url: string | null;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface CreateAgentDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas';
  deanType?: 'male' | 'female';
  phone?: string;
}

export interface AgentFilters {
  role?: 'admin' | 'security_guard' | 'home_dean' | 'vpsas';
  status?: 'active' | 'suspended';
  search?: string;
}

export interface UpdateAgentDto {
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'security_guard' | 'home_dean' | 'vpsas';
  deanType?: 'male' | 'female';
  phone?: string;
}

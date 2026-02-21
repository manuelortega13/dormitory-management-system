export interface Agent {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'security_guard' | 'dean';
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
  role: 'admin' | 'security_guard' | 'dean';
  phone?: string;
}

export interface AgentFilters {
  role?: 'admin' | 'security_guard' | 'dean';
  status?: 'active' | 'suspended';
  search?: string;
}

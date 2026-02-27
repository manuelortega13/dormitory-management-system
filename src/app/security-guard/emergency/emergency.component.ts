import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface EmergencyContact {
  id: number;
  name: string;
  role: string;
  phone: string;
  available: boolean;
}

interface EmergencyProtocol {
  id: number;
  title: string;
  icon: string;
  description: string;
  steps: string[];
}

@Component({
  selector: 'app-emergency',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './emergency.component.html',
  styleUrl: './emergency.component.scss'
})
export class EmergencyComponent {
  emergencyContacts: EmergencyContact[] = [
    { id: 1, name: 'Emergency Hotline', role: 'General Emergency', phone: '911', available: true },
    { id: 2, name: 'Fire Department', role: 'Fire Emergency', phone: '(02) 8426-0219', available: true },
    { id: 3, name: 'PNP Hotline', role: 'Police', phone: '117', available: true },
    { id: 4, name: 'University Clinic', role: 'Medical', phone: '(02) 8123-4567', available: true },
    { id: 5, name: 'Home Dean Office', role: 'Dormitory Admin', phone: '0917-123-4567', available: true },
    { id: 6, name: 'Security Supervisor', role: 'On-Duty Supervisor', phone: '0918-234-5678', available: true },
    { id: 7, name: 'Maintenance Emergency', role: 'Utility Issues', phone: '0919-345-6789', available: false }
  ];

  emergencyProtocols: EmergencyProtocol[] = [
    {
      id: 1,
      title: 'Fire Emergency',
      icon: '🔥',
      description: 'In case of fire, follow these steps immediately:',
      steps: [
        'Activate the nearest fire alarm',
        'Call Fire Department (02) 8426-0219',
        'Evacuate all residents to assembly point',
        'Do NOT use elevators',
        'Account for all residents at assembly point',
        'Wait for fire department clearance'
      ]
    },
    {
      id: 2,
      title: 'Medical Emergency',
      icon: '🏥',
      description: 'For medical emergencies:',
      steps: [
        'Call University Clinic immediately',
        'Do not move injured person unless necessary',
        'Provide first aid if trained',
        'Keep the person calm and comfortable',
        'Document details of the incident',
        'Escort medical personnel to location'
      ]
    },
    {
      id: 3,
      title: 'Security Threat',
      icon: '🚨',
      description: 'For security threats or intruders:',
      steps: [
        'Alert all security personnel via radio',
        'Call PNP Hotline 117 if needed',
        'Do not confront armed individuals',
        'Secure all entry/exit points',
        'Keep residents informed but calm',
        'Document description of suspects'
      ]
    },
    {
      id: 4,
      title: 'Natural Disaster',
      icon: '🌀',
      description: 'For earthquakes, typhoons, or floods:',
      steps: [
        'Sound general alarm',
        'Guide residents to safe areas',
        'For earthquake: Duck, Cover, Hold',
        'Check for structural damage',
        'Account for all residents',
        'Report status to Home Dean'
      ]
    }
  ];

  currentAlert = signal<string | null>(null);

  triggerAlert(alertType: string): void {
    // Disabled in mock mode
  }
}

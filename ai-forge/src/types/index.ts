/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TrainingExample {
  id: string;
  input: string;
  output: string;
  type?: 'manual' | 'file';
  fileName?: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  systemInstruction: string;
  examples: TrainingExample[];
  creatorId: string;
  creatorName: string;
  createdAt: number;
  isPublic: boolean;
  webAccessEnabled: boolean;
  deepThinkEnabled: boolean;
  personalLaptopEnabled: boolean;
  rating: number;
  reviewCount: number;
  downloads: number;
}

export interface Review {
  id: string;
  modelId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

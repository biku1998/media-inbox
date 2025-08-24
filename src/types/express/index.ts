import { Request as ExpressRequest } from 'express';

// Define our custom user payload type
export type UserPayload = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
};

// Extend Express Request to include our typed user
export type Request = ExpressRequest & Record<'user', UserPayload>;

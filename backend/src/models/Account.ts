import { Schema, model } from 'mongoose';

const accountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'draft', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

export const AccountModel = model('Account', accountSchema);



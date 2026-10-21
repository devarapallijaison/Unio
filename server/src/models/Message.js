import mongoose from 'mongoose';
import { schemaOptions } from './enums.js';

/** Project messages (F6). System messages are written by the server on project events. */
const messageSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderRole: { type: String, enum: ['creator', 'brand', 'system'], required: true },
    senderName: { type: String, trim: true, maxlength: 160 },
    body: { type: String, trim: true, maxlength: 2000, required: true },
    about: {
      type: new mongoose.Schema({ deliverableId: mongoose.Schema.Types.ObjectId, versionNumber: Number }, { _id: false }),
      default: undefined,
    },
    kind: { type: String, enum: ['user', 'system'], default: 'user' },
    readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  schemaOptions,
);

messageSchema.index({ projectId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema, 'messages');

import mongoose, { Schema, model, Document } from 'mongoose';

export interface IConfig  {
  key: string;
  value: string;
}

const ConfigSchema = new Schema<IConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

// Correct model name and collection
const ConfigModel = model<IConfig>('Config', ConfigSchema); // Model name should be singular
export default ConfigModel;

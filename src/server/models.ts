/**
 * ReliefLink — Data Models (MongoDB / Mongoose schema style).
 *
 * Pure schema definitions. No server, no DB connection logic.
 * Import and register against your own mongoose connection in your backend.
 *
 *   import mongoose from "mongoose";
 *   import { NGOSchema, RequestSchema, AssignmentSchema } from "./models";
 *   export const NGO = mongoose.model("NGO", NGOSchema);
 *   export const Request = mongoose.model("Request", RequestSchema);
 *   export const Assignment = mongoose.model("Assignment", AssignmentSchema);
 */

import { Schema, type InferSchemaType } from "mongoose";

/* -------------------------------- Shared -------------------------------- */

export const RequestType = ["medical", "food", "rescue", "shelter", "other"] as const;
export type RequestType = (typeof RequestType)[number];

export const Priority = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Priority = (typeof Priority)[number];

export const RequestStatus = ["pending", "assigned", "in_progress", "completed", "cancelled"] as const;
export type RequestStatus = (typeof RequestStatus)[number];

export const AssignmentStatus = ["dispatched", "en_route", "on_site", "completed", "failed"] as const;
export type AssignmentStatus = (typeof AssignmentStatus)[number];

/**
 * GeoJSON Point — enables MongoDB 2dsphere geospatial queries
 * ({ type: "Point", coordinates: [lng, lat] }).
 */
const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v[0] >= -180 && v[0] <= 180 &&
          v[1] >= -90 && v[1] <= 90,
        message: "coordinates must be [lng, lat]",
      },
    },
  },
  { _id: false },
);

/* ---------------------------------- NGO --------------------------------- */

export const NGOSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    location: { type: GeoPointSchema, required: true },
    capabilities: {
      type: [String],
      enum: RequestType,
      required: true,
      validate: { validator: (v: string[]) => v.length > 0, message: "at least one capability required" },
    },
    load: {
      current: { type: Number, default: 0, min: 0 }, // active assignments
      capacity: { type: Number, required: true, min: 1 }, // max concurrent
    },
    contact: {
      phone: { type: String, required: true, trim: true },
      email: { type: String, trim: true, lowercase: true },
      radio: { type: String, trim: true },
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

NGOSchema.index({ location: "2dsphere" });
NGOSchema.index({ capabilities: 1, active: 1 });

export type NGODoc = InferSchemaType<typeof NGOSchema> & { _id: unknown };

/* -------------------------------- Request ------------------------------- */

export const RequestSchema = new Schema(
  {
    type: { type: String, enum: RequestType, required: true, index: true },
    location: { type: GeoPointSchema, required: true },
    status: { type: String, enum: RequestStatus, default: "pending", index: true },
    priority: { type: String, enum: Priority, default: "MEDIUM", index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    requester: {
      name: { type: String, trim: true },
      contact: { type: String, trim: true },
    },
    /** locationDensity = nearby active requests within ~1km (computed by intake pipeline). */
    locationDensity: { type: Number, default: 0, min: 0 },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

RequestSchema.index({ location: "2dsphere" });
RequestSchema.index({ status: 1, priority: 1, timestamp: -1 });

export type RequestDoc = InferSchemaType<typeof RequestSchema> & { _id: unknown };

/* ------------------------------ Assignment ------------------------------ */

export const AssignmentSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    ngoId: { type: Schema.Types.ObjectId, ref: "NGO", required: true, index: true },
    status: { type: String, enum: AssignmentStatus, default: "dispatched", index: true },
    /** ms between request.timestamp and dispatch */
    responseTime: { type: Number, min: 0 },
    /** ms between dispatch and completion */
    resolutionTime: { type: Number, min: 0 },
    /** ranked fallback NGOs if primary fails */
    fallbackNgoIds: [{ type: Schema.Types.ObjectId, ref: "NGO" }],
    matchScore: { type: Number, min: 0, max: 1 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

AssignmentSchema.index({ requestId: 1, status: 1 });
AssignmentSchema.index({ ngoId: 1, status: 1 });

export type AssignmentDoc = InferSchemaType<typeof AssignmentSchema> & { _id: unknown };

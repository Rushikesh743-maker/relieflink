/**
 * ReliefLink core backend logic — public entrypoint.
 *
 * Pure, framework-agnostic modules. No HTTP, no DB connection.
 * Wire these into Express/Fastify/Nest/etc. in your own backend.
 */

export * from "./models";
export * from "./crisisIntelligence";
export * from "./ngoMatching";

// Table definitions land here starting M1 (see docs/ROADMAP.md and the
// data model in docs/SPEC.md). Left empty at M0 so drizzle-kit has a schema file to
// diff against; the only migration at this stage enables the pgcrypto
// extension that gen_random_uuid() will need once tables exist.
export {};

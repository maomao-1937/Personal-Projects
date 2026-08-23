process.env.HOSTNAME ||= "0.0.0.0";
process.env.PORT ||= "3010";

await import("../.next/standalone/server.js");

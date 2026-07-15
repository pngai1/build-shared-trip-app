#!/usr/bin/env node

import assert from "node:assert/strict";
import { scriptSafeJson } from "./init-trip.mjs";

const sentinel = "Literal text: </script><script>window.__tripSkillUnsafe = true</script> & \u2028 \u2029";
const serialized = scriptSafeJson({ sentinel });
assert.equal(serialized.includes("</script>"), false);
assert.equal(serialized.includes("<script>"), false);
assert.equal(serialized.includes("\\u003c"), true);
assert.deepEqual(JSON.parse(serialized), { sentinel });

console.log("Generator script-embedding safety tests passed.");

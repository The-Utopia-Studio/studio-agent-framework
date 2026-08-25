import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';

const schemaPath = process.argv[2];
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

let failures = 0;
for (const f of process.argv.slice(3)) {
  const expectValid = !f.includes('INVALID');
  const ok = validate(JSON.parse(readFileSync(f, 'utf8')));
  const pass = ok === expectValid;
  if (!pass) failures++;
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${f}  (valid=${ok}, expected=${expectValid})`);
  if (!ok && expectValid) console.log(ajv.errorsText(validate.errors, { separator: '\n      ' }));
  if (!ok && !expectValid) console.log(`      correctly rejected: ${ajv.errorsText(validate.errors).slice(0, 160)}`);
}
process.exit(failures ? 1 : 0);

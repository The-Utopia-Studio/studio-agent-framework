import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const compiled = new WeakMap();
export function validateSchema(schema, value, prefix = '') {
  let check = compiled.get(schema);
  if (!check) {
    check = ajv.compile(schema);
    compiled.set(schema, check);
  }
  if (check(value)) return [];
  return check.errors.map((e) => {
    const parts = e.instancePath
      .split('/')
      .filter(Boolean)
      .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (e.keyword === 'required') parts.push(e.params.missingProperty);
    const field = parts.reduce(
      (out, part) => (/^\d+$/.test(part) ? `${out}[${part}]` : out ? `${out}.${part}` : part),
      prefix,
    );
    return { path: field || '$', message: e.message, keyword: e.keyword };
  });
}

/* Publica só o HTML da Aula no horário autorizado, preservando snapshot remoto. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseEnv } = require('node:util');
const state = process.env.SEVILHA_LOTE47_STATE || '/home/codex/.local/state/sevilha/aula-lote47-20261027';
const target = 'aula-gestao-operacional/index.html';
const alias = 'sevilha-perfomance.vercel.app';
const project = { projectId: 'prj_POvAf5LHu471jwcKljqgOSAS1pdd', orgId: 'team_QFKNlEWIaRADsF4B2Ci6eaE7', name: 'sevilha-perfomance' };
const now = Date.now();
assert(now >= Date.parse('2026-10-27T10:00:00Z') && now < Date.parse('2026-10-27T22:00:00Z'), 'Fora da janela autorizada.');
assert(process.argv[2] === '--apply', 'Exige --apply');
const approval = JSON.parse(fs.readFileSync(path.join(state, 'checkout-approved.json')));
assert(approval.price_centavos === 4700 && /^https:\/\/pay\.kiwify\.com\.br\/[A-Za-z0-9]+$/.test(approval.checkout_url));
const token = parseEnv(fs.readFileSync('/home/codex/.claude/credenciais/vercel.env', 'utf8')).VERCEL_TOKEN;
const save = (name, data) => {
  const dest = path.join(state, name + '.json');
  fs.writeFileSync(dest + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(dest + '.tmp', dest);
};
const digest = data => crypto.createHash('sha1').update(data).digest('hex');
async function api(endpoint, options = {}) {
  const response = await fetch('https://api.vercel.com' + endpoint + (endpoint.includes('?') ? '&' : '?') + 'teamId=' + project.orgId,
    { ...options, headers: { Authorization: 'Bearer ' + token, ...options.headers }, signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  assert(response.ok, 'Vercel HTTP ' + response.status);
  return data;
}
function flatten(nodes, prefix = '') {
  return nodes.flatMap(node => node.type === 'directory' ? flatten(node.children, prefix + node.name + '/') : [{ file: prefix + node.name, sha: node.uid }]);
}
async function readSource(id, sha) {
  const data = await api('/v7/deployments/' + id + '/files/' + sha);
  assert(data.data);
  return Buffer.from(data.data, 'base64');
}
async function main() {
  const checked = cp.spawnSync('python3', [path.join(__dirname, 'check-aula-checkout-price.py'), '--checkout', approval.checkout_url, '--expected-centavos', '4700'], { encoding: 'utf8', timeout: 240000 });
  assert.equal(checked.status, 0, 'Checkout47 não confirmado; nenhuma publicação.');
  assert(JSON.parse(checked.stdout).verified);
  const previousPath = path.join(state, 'deployment.json');
  let deployment;
  let evidence;
  if (fs.existsSync(previousPath)) {
    evidence = JSON.parse(fs.readFileSync(previousPath));
    assert(evidence.id, 'Criação anterior incerta; reconciliar sem repetir.');
    deployment = await api('/v13/deployments/' + evidence.id);
  } else {
    const base = await api('/v13/deployments/' + alias);
    assert.equal(base.projectId || base.project?.id, project.projectId);
    assert.equal(base.readyState, 'READY');
    const tree = await api('/v6/deployments/' + base.id + '/files');
    const files = flatten(tree.find(node => node.name === 'src').children);
    const entry = files.find(file => file.file === target);
    assert(entry, 'HTML remoto ausente');
    const original = await readSource(base.id, entry.sha);
    const generator = "import importlib.util,sys;from datetime import datetime,timezone;s=importlib.util.spec_from_file_location('r',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(m.prepare_html(sys.stdin.read(),sys.argv[2],4700,datetime.now(timezone.utc)),end='')";
    const generated = cp.spawnSync('python3', ['-c', generator, path.join(__dirname, 'prepare-aula-price-rollover.py'), approval.checkout_url], { input: original, encoding: 'utf8', maxBuffer: 2000000 });
    assert.equal(generated.status, 0, 'Fonte incompatível; não publicar.');
    const html = Buffer.from(generated.stdout);
    if (digest(html) === digest(original)) {
      save('price-ready', { at: new Date().toISOString(), id: base.id, already_configured: true });
      return;
    }
    assert.equal((await api('/v13/deployments/' + alias)).id, base.id, 'Produção alterada; revisar.');
    const config = JSON.parse((await readSource(base.id, files.find(file => file.file === 'vercel.json').sha)).toString());
    await api('/v2/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': digest(html), 'x-vercel-size': String(html.length) }, body: html });
    const sourceFiles = files.map(file => file.file === target ? { file: target, sha: digest(html) } : { ...file });
    for (let i = 0; i < sourceFiles.length; i++) {
      if (sourceFiles[i].sha.length !== 40) {
        const data = await readSource(base.id, sourceFiles[i].sha);
        sourceFiles[i] = { file: sourceFiles[i].file, data: data.toString('base64'), encoding: 'base64' };
      }
    }
    const settings = Object.fromEntries(Object.entries(base.projectSettings || {}).filter(([key]) => ['buildCommand', 'devCommand', 'framework', 'installCommand', 'outputDirectory', 'nodeVersion'].includes(key)));
    evidence = { state: 'creating', base: base.id, expected_hash: digest(html), files };
    save('deployment', evidence);
    assert(Date.now() < Date.parse('2026-10-27T22:00:00Z'), 'Inscrições encerradas; não publicar.');
    assert.equal((await api('/v13/deployments/' + alias)).id, base.id, 'Produção alterada durante preparo; revisar.');
    deployment = await api('/v13/deployments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, name: project.name, project: project.projectId, target: 'production', files: sourceFiles, projectSettings: settings, meta: { purpose: 'aula-lote47-20261027', sourceDeployment: base.id } }) });
    evidence.id = deployment.id;
    save('deployment', evidence);
  }
  for (let i = 0; i < 20 && !['READY', 'ERROR', 'CANCELED'].includes(deployment.readyState); i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    deployment = await api('/v13/deployments/' + evidence.id);
  }
  assert.equal(deployment.readyState, 'READY', 'Deploy ainda não pronto.');
  assert.equal((await api('/v13/deployments/' + alias)).id, evidence.id, 'Alias não aponta para deploy esperado.');
  const tree = await api('/v6/deployments/' + evidence.id + '/files');
  const actual = new Map(flatten(tree.find(node => node.name === 'src').children).map(file => [file.file, file.sha]));
  assert.equal(actual.get(target), evidence.expected_hash);
  for (const file of evidence.files.filter(file => file.file !== target)) assert.equal(actual.get(file.file), file.sha, 'Arquivo alheio alterado.');
  save('price-ready', { at: new Date().toISOString(), id: evidence.id, state: 'READY', unrelated_changes: 0 });
  console.log(JSON.stringify({ id: evidence.id, state: 'READY', changed: [target] }));
}
main().catch(error => { save('deploy-error', { at: new Date().toISOString(), message: error.message }); process.exitCode = 1; });

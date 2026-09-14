import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRecord, type Project } from '../src/lib/projects';
const image = 'data:image/png;base64,abcd';
test('project persistence preserves edit lineage and actual comparison input but excludes credentials', () => {
  const p = { id: 'project', title: '人像', updatedAt: '2026-09-14', portrait: { src: image, name: 'portrait', isExample: false },
    studioRun: 'v2', breed: 'shiba', customBreed: '', extra: '闭嘴', style: 'photo', freedom: 'head', agentMode: true, delegateBreed: false, agentPlan: null, agentHistory: [],
    keys: { renderer: 'secret-key' }, adminToken: 'admin-secret', runs: [{
      id: 'v2', parentId: 'v1', projectId: 'project', group: 'g', prompt: '闭嘴，保留眼镜', request: '闭嘴', breed: 'shiba',
      portrait: { src: 'data:image/png;base64,dog', name: '选中的狗头作品', isExample: false }, originalPortrait: { src: image, name: 'portrait', isExample: false },
      profile: { id: 'r', name: 'test', provider: 'openai', model: 'image', endpoint: 'https://api.openai.com/v1/images/edits', apiKey: 'secret-key' },
      status: 'loading', startedAt: '2026-09-14', apiKey: 'secret-key',
      settings: { customBreed: '长毛柴犬', style: 'paint', freedom: 'head' },
      trace: [{ type: 'skill', name: 'creation-workflow', version: '1.1.0', sha256: 'a'.repeat(64) }],
    }],
  } as unknown as Project;
  const stored = projectRecord(p);
  assert.equal(stored.runs[0].trace?.[0].type, 'skill');
  assert.deepEqual(stored.runs[0].settings, { customBreed: '长毛柴犬', style: 'paint', freedom: 'head' });
  assert.equal(stored.runs[0].parentId, 'v1'); assert.equal(stored.runs[0].portrait.src, 'data:image/png;base64,dog');
  assert.equal(stored.runs[0].originalPortrait?.src, image); assert.equal(stored.runs[0].status, 'error');
  assert.ok(!JSON.stringify(stored).includes('secret')); assert.ok(!JSON.stringify(stored).includes('apiKey'));
});

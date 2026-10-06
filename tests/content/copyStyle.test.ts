// T85: 참가자에게 보이는 문자열에 기계식 조사 템플릿 "은(는)"이 남아 있지 않은지
// 저장소 전체를 훑어 확인한다(MotionScreen.tsx의 NOT INCLUDED 문구에서 받침 유무와
// 무관하게 "은(는)"을 그대로 붙이던 것을 T85에서 자연문으로 바꿨다). 주석·문서 설명에
// 조사 템플릿 자체를 언급하는 건 허용하고, src 안의 실제 코드 문자열만 본다.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(__dirname, '../../src');

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(full);
    }
    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      return [full];
    }
    return [];
  });
}

describe('참가자 노출 문구에 "은(는)" 템플릿 조사가 없다(T85)', () => {
  it('src 전체에 "은(는)"·"는(은)" 문자열이 없다', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('은(는)') || content.includes('는(은)')) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

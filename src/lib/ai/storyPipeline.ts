export interface GeneratedDreamDraft {
  poemLine: string;
  worldName: string;
  motifs: string[];
  hotspots: Array<{ id: string; label: string; yaw: number; pitch: number; puzzleHook: string }>;
  branchNames: string[];
  panoramaPrompt: string;
  negativePrompt: string;
}

const recommendedLines = [
  '举杯邀明月，对影成三人。',
  '长风破浪会有时，直挂云帆济沧海。',
  '明月出天山，苍茫云海间。',
  '俱怀逸兴壮思飞，欲上青天揽明月。',
  '黄河之水天上来，奔流到海不复回。',
  '孤帆远影碧空尽，惟见长江天际流。',
  '云想衣裳花想容，春风拂槛露华浓。',
];

const motifLexicon = [
  { key: '月', labels: ['月', '明月', '清辉'], branch: '月下问影' },
  { key: '云', labels: ['云', '云海', '云帆'], branch: '云桥远渡' },
  { key: '酒', labels: ['酒', '杯', '樽'], branch: '杯中天地' },
  { key: '水', labels: ['水', '河', '黄河', '长江', '瀑', '海'], branch: '银河回响' },
  { key: '山', labels: ['山', '峰', '天山'], branch: '孤峰听风' },
  { key: '影', labels: ['影', '远影'], branch: '影中照心' },
  { key: '帆', labels: ['帆', '孤帆', '云帆'], branch: '帆影远渡' },
  { key: '花', labels: ['花', '春风', '露'], branch: '花影照梦' },
];

export function recommendPoemLine(seed = Date.now()): string {
  return recommendedLines[Math.abs(seed) % recommendedLines.length];
}

export function generateDreamDraft(poemLine: string): GeneratedDreamDraft {
  const cleanLine = poemLine.trim() || recommendPoemLine();
  const picked = motifLexicon.filter((entry) => entry.labels.some((label) => cleanLine.includes(label)));
  const completed = [
    ...picked,
    ...motifLexicon.filter((entry) => !picked.some((item) => item.key === entry.key)),
  ];
  const motifs = [...new Set(completed.map((entry) => entry.key))].slice(0, 3);
  const branchNames = motifs.map((motif) => motifLexicon.find((entry) => entry.key === motif)?.branch ?? `${motif}中入梦`);
  const worldName = `${motifs.join('')}诗境`;

  return {
    poemLine: cleanLine,
    worldName,
    motifs,
    hotspots: motifs.map((motif, index) => ({
      id: `motif_${index + 1}`,
      label: motif,
      yaw: [-42, 12, 58][index] ?? 0,
      pitch: [18, 6, -10][index] ?? 0,
      puzzleHook: `找到“${motif}”对应的诗意证据，解锁一段分支梦境。`,
    })),
    branchNames,
    panoramaPrompt: [
      '生成一张等距柱状投影 360 度全景图，比例 2:1，适合 Web 全景查看器。',
      `主题：李白诗句“${cleanLine}”生成的${worldName}。`,
      `核心意象：${motifs.join('、')}。`,
      '风格：国风电影感，蓝银月光，金色诗意光点，水墨仙气，宏伟浪漫，高细节。',
      '技术要求：equirectangular 360-degree panoramic image, seamless left-right edge, full spherical environment, no UI, no text, no watermark.',
    ].join('\n'),
    negativePrompt: '现代元素、UI 按钮、文字、水印、边框、重复主体、畸变人物脸、非全景构图',
  };
}

export async function fetchSetListByToken() {
  return {
    name: 'Sample rehearsal — isolated review', updated_at: '2026-09-20T17:00:00Z', songs: [
      { _type: 'set', label: 'First set' },
      { title: 'Long sample chart', song_text: Array.from({ length: 24 }, (_, i) => `#v${i + 1}\nC G Am F\n_A line for reading _across this _sample _page\nC G Am F\n_A second line _keeps the _beat in _place`).join('\n\n'), meta: { title: 'Long sample chart', cols: 1, scale: 100 } },
      { title: 'Second sample song', song_text: '#v\nC G\n_Two simple _lines\n#c\nF C\n_Ready to _play', meta: { title: 'Second sample song' } },
      { _type: 'custom-song', title: 'Two-page sample PDF', pdf: { path: 'fixture.pdf', name: 'Sample PDF' } },
      { _type: 'break', label: 'Water break', duration: 5 },
      { _type: 'note', label: 'Rehearsal note', text: 'All content in this preview is invented.' },
      { _type: 'custom-song', title: 'No PDF yet' },
    ],
  }
}
export async function fetchSetListPdfUrl() { return '/fixture.pdf' }

/** Starting points that match the backend's task validator, since no per-template form exists yet. */
export const SAMPLES: Record<string, { content: object; evaluation: object }> = {
  select: {
    content: {
      promptVariants: { text: { text: 'Chọn nghĩa đúng của từ "ticket".' } },
      options: [{ id: 1, text: 'vé' }, { id: 2, text: 'hợp đồng' }, { id: 3, text: 'thực đơn' }],
    },
    evaluation: { correctOptionId: 1 },
  },
  match: {
    content: {
      promptVariants: { text: { text: 'Ghép từ với nghĩa.' } },
      pairs: {
        left: [{ id: 1, text: 'ticket' }, { id: 2, text: 'menu' }],
        right: [{ id: 1, text: 'vé' }, { id: 2, text: 'thực đơn' }],
      },
    },
    evaluation: { correctPairs: [{ leftId: 1, rightId: 1 }, { leftId: 2, rightId: 2 }] },
  },
  cloze_select: {
    content: {
      promptVariants: {},
      sentenceParts: { before: 'Please show your ', after: ' to the conductor.' },
      options: [{ id: 1, text: 'ticket' }, { id: 2, text: 'menu' }],
    },
    evaluation: { correctOptionId: 1 },
  },
  typing: {
    content: { promptVariants: { text: { text: 'Gõ từ tiếng Anh có nghĩa là "vé".' } } },
    evaluation: { acceptedResponses: ['ticket'] },
  },
  fly_reorder: {
    content: {
      promptVariants: { text: { text: 'Sắp xếp các chữ thành từ có nghĩa là "vé".' } },
      tiles: [{ id: 1, text: 'ket' }, { id: 2, text: 'tic' }],
    },
    evaluation: { acceptedResponses: ['ticket'] },
  },
  surgery: {
    content: { promptVariants: { text: { text: 'Sửa lỗi chính tả.' } }, word: 'tickit' },
    evaluation: { wrongGraphemeIndex: 4, replacement: 'e' },
  },
  recording: {
    content: { promptVariants: { text: { text: 'Đọc to: ticket' } }, assessment: { kind: 'azurePronunciation' } },
    evaluation: { referenceText: 'ticket' },
  },
}

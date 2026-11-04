export function moveTask<T extends { id: string }>(items: readonly T[], id: string, target: number): T[] {
  const index = items.findIndex(item => item.id === id);
  if (index < 0 || target < 0 || target >= items.length || target === index) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
}

export function mountTaskReorder(list: HTMLUListElement, move: (id: string, index: number) => void): () => void {
  let drag: { row: HTMLElement; from: number; to: number } | undefined;
  const rows = () => [...list.querySelectorAll<HTMLElement>(':scope > li[data-task-id]')].filter(row => !row.inert);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.documentElement.hasAttribute('data-reduced-motion');
  const animations = new Map<HTMLElement, Animation>();
  function settle() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
  }
  const motionChanged = () => { if (reduced()) settle(); };
  media.addEventListener('change', motionChanged);
  const observer = new MutationObserver(motionChanged);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
  function reset() {
    for (const row of rows()) {
      row.classList.remove('task-lifted');
      row.style.removeProperty('--task-shift');
    }
    drag = undefined;
  }
  function reorder(id: string, to: number) {
    // Sample before cancelling an interrupted reorder or releasing the drag preview.
    const positions = reduced() ? new Map<HTMLElement, number>()
      : new Map(rows().map(row => [row, row.getBoundingClientRect().top]));
    settle();
    reset();
    move(id, to);
    if (reduced()) return;
    for (const row of rows()) {
      const before = positions.get(row);
      if (before === undefined) continue;
      const delta = before - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.01) continue;
      // Individual translate composes with the existing drag-preview transform.
      const animation = row.animate([{ translate: `0px ${delta}px` }, { translate: '0px 0px' }],
        { duration: 300, easing: 'cubic-bezier(.2,0,.2,1)', fill: 'backwards' });
      animations.set(row, animation);
      void animation.finished.then(() => { if (animations.get(row) === animation) animations.delete(row); }, () => {});
    }
  }
  const start = (event: DragEvent) => {
    const handle = (event.target as Element | null)?.closest('.task-drag-handle');
    const row = handle?.closest<HTMLElement>('li[data-task-id]');
    if (!row || !event.dataTransfer) return;
    const from = rows().indexOf(row);
    if (from < 0) return;
    drag = { row, from, to: from };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.taskId ?? '');
    event.dataTransfer.setDragImage(row, 12, row.offsetHeight / 2);
    requestAnimationFrame(() => { if (drag?.row === row) row.classList.add('task-lifted'); });
  };
  const over = (event: DragEvent) => {
    if (drag && !drag.row.isConnected) reset();
    if (!drag || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const items = rows();
    const y = event.clientY - list.getBoundingClientRect().top;
    let to = items.findIndex(row => y <= row.offsetTop + row.offsetHeight / 2);
    if (to < 0) to = items.length - 1;
    if (to === drag.to) return;
    drag.to = to;
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
    const distance = drag.row.offsetHeight + gap;
    items.forEach((row, index) => {
      const shift = index > drag!.from && index <= to ? -distance
        : index < drag!.from && index >= to ? distance : 0;
      row.style.setProperty('--task-shift', `${shift}px`);
    });
  };
  const drop = (event: DragEvent) => {
    if (drag && !drag.row.isConnected) reset();
    if (!drag) return;
    event.preventDefault();
    const { row, from, to } = drag;
    const id = row.dataset.taskId;
    if (id && from !== to) reorder(id, to);
    else reset();
  };
  const keyboard = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const handle = (event.target as Element | null)?.closest('.task-drag-handle');
    const row = handle?.closest<HTMLElement>('li[data-task-id]');
    const id = row?.dataset.taskId;
    if (!row || !id) return;
    const items = rows();
    const index = items.indexOf(row);
    const to = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    event.preventDefault();
    reorder(id, to);
    rows()[to]?.querySelector<HTMLElement>('.task-drag-handle')?.focus({ preventScroll: true });
  };
  list.addEventListener('dragstart', start);
  list.addEventListener('dragover', over);
  list.addEventListener('drop', drop);
  list.addEventListener('dragend', reset);
  list.addEventListener('keydown', keyboard);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', motionChanged);
    settle();
    reset();
    list.removeEventListener('dragstart', start);
    list.removeEventListener('dragover', over);
    list.removeEventListener('drop', drop);
    list.removeEventListener('dragend', reset);
    list.removeEventListener('keydown', keyboard);
  };
}

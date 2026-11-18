// The app used to be called TypeRight. Copy its saved keys to the new names once, so nobody loses progress.
for (const store of [() => localStorage, () => sessionStorage]) {
  try {
    const s = store()
    for (const key of ['settings', 'progress', 'wallpaper']) {
      const old = s.getItem(`typeright.${key}`)
      if (old !== null && s.getItem(`typeshi.${key}`) === null) s.setItem(`typeshi.${key}`, old)
      s.removeItem(`typeright.${key}`)
    }
  } catch {
    // storage blocked: nothing to migrate
  }
}

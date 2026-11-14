/** App version from package.json, injected at build time. */
export const APP_VERSION: string = __APP_VERSION__

/** Build date as dd/mm/yyyy (Vietnamese order). */
export const BUILD_DATE: string = (() => {
  const d = new Date(__BUILD_DATE__)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
})()

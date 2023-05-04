import Unocss from 'unocss/vite'

export default {
  plugins: [
    Unocss({
      configFile: './uno.config.ts',
    }),
  ],
}
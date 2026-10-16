// ESLint flat config. Type errors are left to `tsc -b` in `npm run build`,
// so no rule here needs type information. eslint-config-prettier comes last
// and turns off rules that would fight Prettier's formatting.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  prettier,
)

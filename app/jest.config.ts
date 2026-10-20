import type { Config } from 'jest';

// Modules held to the coverage threshold. A module is added in the same change that adds its tests.
const COVERED_MODULES: string[] = [
  'src/app.ts',
  'src/config/app.config.ts',
  'src/config/db.config.ts',
  'src/config/keys.config.ts',
  'src/common/log-redaction.ts',
  'src/common/db/app-data-source.ts',
  'src/common/transformers/encryption.transformer.ts',
  'src/controllers/auth.controller.ts',
  'src/controllers/role.controller.ts',
  'src/controllers/user.controller.ts',
  'src/commands/auth/authenticate.command.ts',
  'src/commands/auth/create-token.command.ts',
  'src/commands/auth/get-jwks.command.ts',
  'src/commands/auth/refresh-token.command.ts',
  'src/commands/auth/revoke-token.command.ts',
  'src/commands/role/create-role.command.ts',
  'src/commands/role/delete-role.command.ts',
  'src/commands/role/delete-roles.command.ts',
  'src/commands/role/get-role.command.ts',
  'src/commands/role/get-roles.command.ts',
  'src/commands/role/update-role.command.ts',
  'src/commands/user/create-user.command.ts',
  'src/commands/user/delete-user.command.ts',
  'src/commands/user/get-user.command.ts',
  'src/commands/user/get-users.command.ts',
  'src/commands/user/update-user.command.ts',
  'src/services/auth.service.ts',
  'src/services/role.service.ts',
  'src/services/user.service.ts',
  'src/entities/user/user.entity.ts',
  'src/entities/user/role.entity.ts',
  'src/datasources/users.datasource.ts',
];

// Compiles each file on its own, as tsc would emit it, without type-checking (pnpm typecheck does that).
// Not SWC: its CommonJS exports break the decorator metadata of entities that import each other.
// jose ships only as an ES module, which this runtime cannot require, so its files are compiled to CommonJS
// too; the JWKS tests then run the jose production uses.
const tsTransform: Config['transform'] = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  '^.+/node_modules/(\\.pnpm/jose@[^/]+/node_modules/)?jose/.+\\.js$': [
    'ts-jest',
    { tsconfig: { allowJs: true, module: 'CommonJS', target: 'ES2022', isolatedModules: true } },
  ],
};

// Everything under node_modules loads as it is, except jose.
const transformIgnorePatterns = ['/node_modules/(?!\\.pnpm/jose@|jose/)'];

const SRC_ALIAS = { '^@/(.*)$': '<rootDir>/src/$1' };

const config: Config = {
  collectCoverageFrom: COVERED_MODULES,
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
  projects: [
    {
      displayName: 'unit',
      roots: ['<rootDir>/src'],
      testMatch: ['**/*.test.ts'],
      testEnvironment: 'node',
      transform: tsTransform,
      transformIgnorePatterns,
      moduleNameMapper: {
        '^@spalx/common-loggers-pkg$': '<rootDir>/test/mocks/common-loggers.ts',
        ...SRC_ALIAS,
      },
      globalSetup: '<rootDir>/test/setup/keys-global-setup.ts',
      globalTeardown: '<rootDir>/test/setup/keys-global-teardown.ts',
      setupFiles: ['<rootDir>/test/setup/env.ts', '<rootDir>/test/setup/no-network.ts'],
      clearMocks: true,
    },
    {
      displayName: 'integration',
      roots: ['<rootDir>/test/integration'],
      testMatch: ['**/*.int.test.ts'],
      testEnvironment: 'node',
      transform: tsTransform,
      transformIgnorePatterns,
      moduleNameMapper: {
        '^@spalx/common-loggers-pkg$': '<rootDir>/test/mocks/common-loggers.ts',
        '^@/config/db\\.config$': '<rootDir>/test/setup/integration-db.config.ts',
        ...SRC_ALIAS,
      },
      globalSetup: '<rootDir>/test/setup/integration-global-setup.ts',
      globalTeardown: '<rootDir>/test/setup/integration-global-teardown.ts',
      setupFiles: ['<rootDir>/test/setup/env.ts', '<rootDir>/test/setup/no-network.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/integration.ts'],
      clearMocks: true,
    },
  ],
};

export default config;

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/test/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 90,
      statements: 90,
      functions: 85,
      branches: 80,
    },
  },
};

export default config;

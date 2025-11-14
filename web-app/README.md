# Web Application

React + TypeScript frontend application with federated authentication.

## Features

- React 18+ with TypeScript 5+ (strict mode)
- React Router for navigation
- Environment variable configuration
- Build optimization and code splitting
- ESLint and Prettier for code quality

## Prerequisites

- Node.js 20+
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration values

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Create production build with optimization
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code
- `npm run lint:fix` - Lint and fix code
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── components/      # React components
├── services/        # API clients and business logic
├── hooks/           # Custom React hooks
├── contexts/        # React contexts (Auth, etc.)
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── config/          # Configuration files
├── App.tsx          # Main application component
└── index.tsx        # Application entry point
```

## Environment Variables

Required environment variables (see `.env.example`):

- `REACT_APP_API_URL` - API Gateway endpoint
- `REACT_APP_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `REACT_APP_COGNITO_CLIENT_ID` - Cognito Client ID
- `REACT_APP_COGNITO_DOMAIN` - Cognito domain for OAuth
- `REACT_APP_AWS_REGION` - AWS region

## Build Optimization

The production build includes:

- Code splitting for optimal bundle size
- Minification and compression
- Tree shaking to remove unused code
- Source maps for debugging
- Asset optimization

## TypeScript Configuration

The project uses strict TypeScript configuration:

- Strict mode enabled
- No unused locals or parameters
- No implicit returns
- No fallthrough cases in switch statements
- Force consistent casing in file names

## Code Quality

- ESLint for code linting
- Prettier for code formatting
- Husky for pre-commit hooks
- TypeScript for type safety

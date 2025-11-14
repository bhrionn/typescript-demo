---
inclusion: always
---

# Product Overview

This is a modern, enterprise-grade TypeScript application demonstrating federated authentication with comprehensive AWS cloud infrastructure. The system enables users to authenticate via Google or Microsoft accounts and securely upload files through a React-based web interface.

## Core Features

- Federated authentication (Google, Microsoft) via AWS Cognito
- Secure file upload with metadata tracking
- Global content delivery via CloudFront CDN
- Enterprise-grade security controls (WAF, VPC isolation, encryption)
- Serverless API architecture with AWS Lambda
- Infrastructure as code using AWS CDK

## Architecture

The application consists of three main components:

1. **Web Application** - React + TypeScript frontend
2. **API & Lambda Functions** - Serverless backend with Node.js
3. **AWS Infrastructure** - CDK-managed cloud resources

## Design Principles

All code follows SOLID design principles:

- Single Responsibility: Each class has one reason to change
- Open-Closed: Extension without modification
- Liskov Substitution: Derived classes are substitutable
- Interface Segregation: Focused interfaces
- Dependency Inversion: Depend on abstractions, not concretions

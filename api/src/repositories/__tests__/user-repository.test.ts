/**
 * Unit tests for User Repository
 * Requirements: 10.4
 */

import { UserRepository } from '../user-repository.impl';
import { IDatabaseConnection } from '../base-repository';
import { User } from '../../types/database';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockDb: jest.Mocked<IDatabaseConnection>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    provider: 'google',
    providerId: 'google-123',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-02'),
  };

  beforeEach(() => {
    mockDb = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      query: jest.fn(),
      queryOne: jest.fn(),
      transaction: jest.fn(),
      isHealthy: jest.fn(),
    };

    userRepository = new UserRepository(mockDb);
  });

  describe('findById', () => {
    it('should find a user by ID', async () => {
      mockDb.queryOne.mockResolvedValue(mockUser);

      const result = await userRepository.findById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, provider'),
        [mockUser.id]
      );
    });

    it('should return null when user not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await userRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all users without criteria', async () => {
      mockDb.query.mockResolvedValue([mockUser]);

      const result = await userRepository.findAll();

      expect(result).toEqual([mockUser]);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        []
      );
    });

    it('should find users by email', async () => {
      mockDb.query.mockResolvedValue([mockUser]);

      const result = await userRepository.findAll({ email: 'test@example.com' });

      expect(result).toEqual([mockUser]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), [
        'test@example.com',
      ]);
    });

    it('should find users by provider', async () => {
      mockDb.query.mockResolvedValue([mockUser]);

      const result = await userRepository.findAll({ provider: 'google' });

      expect(result).toEqual([mockUser]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), ['google']);
    });

    it('should find users by multiple criteria', async () => {
      mockDb.query.mockResolvedValue([mockUser]);

      const result = await userRepository.findAll({
        provider: 'google',
        providerId: 'google-123',
      });

      expect(result).toEqual([mockUser]);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('WHERE'), [
        'google',
        'google-123',
      ]);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const newUser = {
        email: 'new@example.com',
        provider: 'microsoft' as const,
        providerId: 'ms-456',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockDb.queryOne.mockResolvedValue({ ...mockUser, ...newUser });

      const result = await userRepository.create(newUser);

      expect(result.email).toBe(newUser.email);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
        newUser.email,
        newUser.provider,
        newUser.providerId,
        newUser.lastLoginAt,
      ]);
    });

    it('should create user with null lastLoginAt', async () => {
      const newUser = {
        email: 'new@example.com',
        provider: 'google' as const,
        providerId: 'google-789',
        createdAt: new Date(),
        lastLoginAt: null,
      };

      mockDb.queryOne.mockResolvedValue({ ...mockUser, ...newUser });

      const result = await userRepository.create(newUser);

      expect(result).toBeDefined();
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
        newUser.email,
        newUser.provider,
        newUser.providerId,
        null,
      ]);
    });

    it('should throw error when creation fails', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        userRepository.create({
          email: 'test@example.com',
          provider: 'google',
          providerId: 'google-123',
          createdAt: new Date(),
          lastLoginAt: null,
        })
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('update', () => {
    it('should update user email', async () => {
      const updatedUser = { ...mockUser, email: 'updated@example.com' };
      mockDb.queryOne.mockResolvedValue(updatedUser);

      const result = await userRepository.update(mockUser.id, {
        email: 'updated@example.com',
      });

      expect(result.email).toBe('updated@example.com');
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
        'updated@example.com',
        mockUser.id,
      ]);
    });

    it('should update multiple fields', async () => {
      const updates = {
        email: 'updated@example.com',
        lastLoginAt: new Date(),
      };
      mockDb.queryOne.mockResolvedValue({ ...mockUser, ...updates });

      const result = await userRepository.update(mockUser.id, updates);

      expect(result.email).toBe(updates.email);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([updates.email, updates.lastLoginAt, mockUser.id])
      );
    });

    it('should throw error when no fields to update', async () => {
      await expect(userRepository.update(mockUser.id, {})).rejects.toThrow('No fields to update');
    });

    it('should throw error when user not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        userRepository.update('non-existent-id', { email: 'test@example.com' })
      ).rejects.toThrow('User with id non-existent-id not found');
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      mockDb.query.mockResolvedValue([{ id: mockUser.id }]);

      const result = await userRepository.delete(mockUser.id);

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', [mockUser.id]);
    });

    it('should return false when user not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await userRepository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when user exists', async () => {
      mockDb.queryOne.mockResolvedValue({ exists: 1 });

      const result = await userRepository.exists(mockUser.id);

      expect(result).toBe(true);
      expect(mockDb.queryOne).toHaveBeenCalledWith('SELECT 1 FROM users WHERE id = $1', [
        mockUser.id,
      ]);
    });

    it('should return false when user does not exist', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await userRepository.exists('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      mockDb.queryOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockDb.queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE email = $1'), [
        'test@example.com',
      ]);
    });

    it('should return null when user not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await userRepository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByProvider', () => {
    it('should find a user by provider and providerId', async () => {
      mockDb.queryOne.mockResolvedValue(mockUser);

      const result = await userRepository.findByProvider('google', 'google-123');

      expect(result).toEqual(mockUser);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE provider = $1 AND provider_id = $2'),
        ['google', 'google-123']
      );
    });

    it('should return null when user not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await userRepository.findByProvider('microsoft', 'ms-999');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should insert new user when not exists', async () => {
      const newUser = {
        email: 'new@example.com',
        provider: 'google' as const,
        providerId: 'google-new',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockDb.queryOne.mockResolvedValue({ ...mockUser, ...newUser });

      const result = await userRepository.upsert(newUser);

      expect(result.email).toBe(newUser.email);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (provider, provider_id)'),
        expect.arrayContaining([newUser.email, newUser.provider, newUser.providerId])
      );
    });

    it('should update existing user on conflict', async () => {
      const existingUser = {
        email: 'updated@example.com',
        provider: 'google' as const,
        providerId: 'google-123',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockDb.queryOne.mockResolvedValue({ ...mockUser, ...existingUser });

      const result = await userRepository.upsert(existingUser);

      expect(result.email).toBe(existingUser.email);
    });

    it('should throw error when upsert fails', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      await expect(
        userRepository.upsert({
          email: 'test@example.com',
          provider: 'google',
          providerId: 'google-123',
          createdAt: new Date(),
          lastLoginAt: null,
        })
      ).rejects.toThrow('Failed to upsert user');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      mockDb.query.mockResolvedValue([]);

      await userRepository.updateLastLogin(mockUser.id);

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE users'), [
        mockUser.id,
      ]);
    });
  });
});

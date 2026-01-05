import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import bcrypt from 'bcryptjs';
import type { User } from '@/lib/types';
import { isPhase2Enabled, getFeatureUnavailableMessage } from '@/lib/feature-flags';

// Superadmin emails - only these can create/delete/promote admins
const SUPERADMIN_EMAILS = [
  'gabriel@elementscentral.com',
  'info@upstreamcreatives.co.za',
  'mains@elementscentral.com',
  'admin@eodsa.com'
];

// Helper to check if user is superadmin
async function isSuperadmin(email: string): Promise<boolean> {
  if (SUPERADMIN_EMAILS.includes(email.toLowerCase())) {
    return true;
  }
  const { getSql } = await import('@/lib/database');
  const sqlClient = getSql();
  const result = await sqlClient`SELECT role FROM judges WHERE email = ${email.toLowerCase()}` as any[];
  return result.length > 0 && result[0].role === 'superadmin';
}

// Helper to get current user from request
async function getCurrentUser(request: Request): Promise<User | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    
    const userId = authHeader.replace('Bearer ', '');
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM judges WHERE id = ${userId}` as any[];
    
    if (result.length === 0) return null;
    
    const row = result[0];
    let staffPermissions;
    try {
      staffPermissions = row.staff_permissions 
        ? (typeof row.staff_permissions === 'string' 
            ? JSON.parse(row.staff_permissions) 
            : row.staff_permissions)
        : undefined;
    } catch {
      staffPermissions = undefined;
    }
    
    let specialization;
    try {
      specialization = row.specialization 
        ? (typeof row.specialization === 'string' 
            ? JSON.parse(row.specialization) 
            : row.specialization)
        : [];
    } catch {
      specialization = [];
    }
    
    // Map role to userType for frontend
    const roleToUserType = (role: string, isAdmin: boolean): 'judge' | 'staff' | 'admin' | 'superadmin' => {
      if (role === 'superadmin') return 'superadmin';
      if (role === 'admin') return 'admin';
      if (['backstage_manager', 'announcer', 'registration', 'media'].includes(role)) return 'staff';
      return 'judge';
    };

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || undefined,
      password: row.password,
      userType: roleToUserType(row.role || 'judge', row.is_admin),
      isAdmin: row.is_admin,
      role: row.role || 'judge',
      specialization,
      staffPermissions,
      createdAt: row.created_at
    };
  } catch {
    return null;
  }
}

// GET /api/users - Get all users
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userType = searchParams.get('userType');
    
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();
    const result = await sqlClient`SELECT * FROM judges` as any[];
    
    // Convert to User format
    const users: User[] = result.map((row: any) => {
      let staffPermissions;
      try {
        staffPermissions = row.staff_permissions 
          ? (typeof row.staff_permissions === 'string' 
              ? JSON.parse(row.staff_permissions) 
              : row.staff_permissions)
          : undefined;
      } catch {
        staffPermissions = undefined;
      }
      
      let specialization;
      try {
        specialization = row.specialization 
          ? (typeof row.specialization === 'string' 
              ? JSON.parse(row.specialization) 
              : row.specialization)
          : [];
      } catch {
        specialization = [];
      }
      
      // Map role to userType for frontend
      const roleToUserType = (role: string, isAdmin: boolean): 'judge' | 'staff' | 'admin' | 'superadmin' => {
        if (role === 'superadmin') return 'superadmin';
        if (role === 'admin') return 'admin';
        if (['backstage_manager', 'announcer', 'registration', 'media'].includes(role)) return 'staff';
        return 'judge';
      };

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || undefined,
        password: '', // Don't return password
        userType: roleToUserType(row.role || 'judge', row.is_admin),
        isAdmin: row.is_admin,
        role: row.role || 'judge',
        specialization,
        staffPermissions,
        createdAt: row.created_at
      };
    });
    
    // Filter by userType if provided
    const filteredUsers = userType 
      ? users.filter(u => u.userType === userType)
      : users;
    
    return NextResponse.json({
      success: true,
      users: filteredUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: Request) {
  // Check Phase 2 feature flag - block Create User
  if (!isPhase2Enabled()) {
    return NextResponse.json(
      { success: false, error: getFeatureUnavailableMessage() },
      { status: 403 }
    );
  }

  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      phone,
      userType,
      staffPermissions 
    } = body;
    
    // Validate required fields
    if (!name || !email || !password || !userType) {
      return NextResponse.json(
        { success: false, error: 'Name, email, password, and userType are required' },
        { status: 400 }
      );
    }
    
    // Validate userType
    const validUserTypes = ['judge', 'staff', 'admin', 'superadmin'];
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid userType. Must be one of: ' + validUserTypes.join(', ') },
        { status: 400 }
      );
    }
    
    // Superadmin-only operations
    if (userType === 'admin' || userType === 'superadmin') {
      const isSuper = await isSuperadmin(currentUser.email);
      if (!isSuper) {
        return NextResponse.json(
          { success: false, error: 'Only superadmins can create admin or superadmin accounts' },
          { status: 403 }
        );
      }
    }
    
    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }
    
    // Check if email already exists
    const existingUser = await db.getJudgeByEmail(email.toLowerCase().trim());
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      );
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Determine role based on userType
    // Map userType to role: superadmin -> 'superadmin', admin -> 'admin', staff -> 'backstage_manager', judge -> 'judge'
    let role: 'judge' | 'admin' | 'superadmin' | 'backstage_manager' | 'announcer' | 'registration' | 'media' = 'judge';
    if (userType === 'superadmin') {
      role = 'superadmin';
    } else if (userType === 'admin') {
      role = 'admin';
    } else if (userType === 'staff') {
      // Default staff role, can be overridden by staffPermissions
      role = 'backstage_manager';
    } else {
      role = 'judge';
    }
    
    // is_admin: true for admin and superadmin, false for judge and staff
    const isAdmin = userType === 'admin' || userType === 'superadmin';
    
    // Create the user using database helper
    const { getSql } = await import('@/lib/database');
    const sqlClient = getSql();
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    await sqlClient`
      INSERT INTO judges (
        id, name, email, password, phone, is_admin, role, 
        staff_permissions, specialization, created_at
      )
      VALUES (
        ${id}, 
        ${name.trim()}, 
        ${email.toLowerCase().trim()}, 
        ${hashedPassword},
        ${phone || null},
        ${isAdmin},
        ${role},
        ${staffPermissions ? JSON.stringify(staffPermissions) : '{}'},
        '[]',
        ${timestamp}
      )
    `;
    
    // Return success without password
    const newUser: User = {
      id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || undefined,
      password: '', // Don't return password
      userType,
      isAdmin: userType === 'admin' || userType === 'superadmin',
      role: role as 'judge' | 'admin' | 'backstage_manager' | 'announcer' | 'registration' | 'media',
      specialization: [],
      staffPermissions,
      createdAt: timestamp
    };
    
    return NextResponse.json({
      success: true,
      user: newUser,
      message: `${userType} account created successfully`
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}


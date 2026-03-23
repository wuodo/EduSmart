import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from './_auditStore';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const SETTINGS_FILE = path.join(DATA_DIR, 'marketing-settings.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function readSettingsFromDisk() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeSettingsToDisk(data: any) {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// In-memory default (used if no file yet)
let settings = {
  institution: {
    name: 'EduSmart College',
    logo: '',
    email: 'info@edusmart.edu',
    phone: '+1234567890',
    address: '123 Main St, City, Country',
  },
  passwordPolicy: {
    minLength: 8,
    requireSpecial: true,
    expiryDays: 90,
  },
};

export async function GET() {
  try {
    const disk = await readSettingsFromDisk();
    const data = disk || settings;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
  const data = await req.json();

    // Load latest from disk (if present)
    const disk = await readSettingsFromDisk();
    if (disk) settings = disk;

    // Validate request data
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    let hasChanges = false;

    // Update institution details if provided
    if (data.institution && typeof data.institution === 'object') {
      const { name, email, phone, address, logo } = data.institution;

      if (name !== undefined && typeof name === 'string') {
        settings.institution.name = name.trim();
        hasChanges = true;
      }

      if (email !== undefined && typeof email === 'string') {
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
          return NextResponse.json(
            { error: 'Invalid email format' },
            { status: 400 }
          );
        }
        settings.institution.email = email.trim();
        hasChanges = true;
      }

      if (phone !== undefined && typeof phone === 'string') {
        if (!/^\+?\d{7,15}$/.test(phone.trim())) {
          return NextResponse.json(
            { error: 'Invalid phone number format' },
            { status: 400 }
          );
        }
        settings.institution.phone = phone.trim();
        hasChanges = true;
      }

      if (address !== undefined && typeof address === 'string') {
        settings.institution.address = address.trim();
        hasChanges = true;
  }

      if (logo !== undefined && typeof logo === 'string') {
        settings.institution.logo = logo;
        hasChanges = true;
      }
    }

    // Update password policy if provided
    if (data.passwordPolicy && typeof data.passwordPolicy === 'object') {
      const { minLength, requireSpecial, expiryDays } = data.passwordPolicy;

      if (minLength !== undefined && typeof minLength === 'number') {
        if (minLength < 6 || minLength > 50) {
          return NextResponse.json(
            { error: 'Minimum length must be between 6 and 50 characters' },
            { status: 400 }
          );
        }
        settings.passwordPolicy.minLength = minLength;
        hasChanges = true;
      }

      if (requireSpecial !== undefined && typeof requireSpecial === 'boolean') {
        settings.passwordPolicy.requireSpecial = requireSpecial;
        hasChanges = true;
      }

      if (expiryDays !== undefined && typeof expiryDays === 'number') {
        if (expiryDays < 0 || expiryDays > 365) {
          return NextResponse.json(
            { error: 'Expiry days must be between 0 and 365' },
            { status: 400 }
          );
        }
        settings.passwordPolicy.expiryDays = expiryDays;
        hasChanges = true;
  }
    }

    if (!hasChanges) {
      return NextResponse.json(
        { error: 'No valid changes provided' },
        { status: 400 }
      );
    }

    // Persist to disk
    await writeSettingsToDisk(settings);

    // Log to audit trail
    const { getCurrentUser } = await import('./_getCurrentUser');
    const currentUser = await getCurrentUser(req);
    const user = currentUser?.email || 'unknown';
    const ip = req.headers.get('x-forwarded-for') || undefined;
    addAuditLog({
      action: 'update_settings',
      module: 'settings',
      user,
      ip,
      details: data,
    });

    console.log('Settings updated:', settings);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
} 
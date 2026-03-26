import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const COURSES_FILE = path.join(__dirname, '../../data/courses.json');

interface Course {
  id: string;
  name: string;
  code?: string;
  category: string;
  duration: string;
  level: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

function readCourses(): Course[] {
  try {
    if (!fs.existsSync(COURSES_FILE)) return [];
    return JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8')) as Course[];
  } catch {
    return [];
  }
}

function writeCourses(courses: Course[]): void {
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2));
}

export const getAllCourses = (_req: Request, res: Response) => {
  try {
    return res.json(readCourses());
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch courses' });
  }
};

export const createCourse = (req: Request, res: Response) => {
  try {
    const { name, code, category, duration, level, description } = req.body;
    if (!name || !category || !duration || !level) {
      return res.status(400).json({ message: 'name, category, duration, and level are required' });
    }
    const courses = readCourses();
    const now = new Date().toISOString();
    const newCourse: Course = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(name).trim(),
      code: code ? String(code).trim() : undefined,
      category: String(category).trim(),
      duration: String(duration).trim(),
      level: String(level).trim(),
      description: description ? String(description).trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };
    courses.push(newCourse);
    writeCourses(courses);
    return res.status(201).json(newCourse);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to create course' });
  }
};

export const updateCourse = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const courses = readCourses();
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ message: 'Course not found' });
    const { name, code, category, duration, level, description } = req.body;
    courses[idx] = {
      ...courses[idx],
      name: name ? String(name).trim() : courses[idx].name,
      code: code !== undefined ? String(code).trim() : courses[idx].code,
      category: category ? String(category).trim() : courses[idx].category,
      duration: duration ? String(duration).trim() : courses[idx].duration,
      level: level ? String(level).trim() : courses[idx].level,
      description: description !== undefined ? String(description).trim() : courses[idx].description,
      updatedAt: new Date().toISOString(),
    };
    writeCourses(courses);
    return res.json(courses[idx]);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to update course' });
  }
};

export const deleteCourse = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const courses = readCourses();
    const filtered = courses.filter(c => c.id !== id);
    if (filtered.length === courses.length) return res.status(404).json({ message: 'Course not found' });
    writeCourses(filtered);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to delete course' });
  }
};

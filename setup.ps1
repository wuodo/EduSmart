# Create frontend directories
New-Item -ItemType Directory -Force -Path "frontend/src/app"
New-Item -ItemType Directory -Force -Path "frontend/src/components"
New-Item -ItemType Directory -Force -Path "frontend/src/types"
New-Item -ItemType Directory -Force -Path "frontend/src/lib"

# Create backend directories
New-Item -ItemType Directory -Force -Path "backend/src/controllers"
New-Item -ItemType Directory -Force -Path "backend/src/models"
New-Item -ItemType Directory -Force -Path "backend/src/routes"
New-Item -ItemType Directory -Force -Path "backend/src/middleware"
New-Item -ItemType Directory -Force -Path "backend/src/utils"
New-Item -ItemType Directory -Force -Path "backend/src/config"

# Install frontend dependencies
Set-Location frontend
npm install next@latest react@latest react-dom@latest typescript@latest @types/react@latest @types/node@latest @types/react-dom@latest tailwindcss@latest postcss@latest autoprefixer@latest eslint@latest eslint-config-next@latest @headlessui/react @heroicons/react

# Install backend dependencies
Set-Location ../backend
npm install express cors dotenv mongoose multer zod
npm install --save-dev @types/express @types/cors @types/node typescript ts-node-dev @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint

# Return to root directory
Set-Location .. 
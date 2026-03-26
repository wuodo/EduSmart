# Move frontend files
Move-Item -Path "src/app/*" -Destination "frontend/src/app/" -Force
Move-Item -Path "src/components/*" -Destination "frontend/src/components/" -Force
Move-Item -Path "src/types/*" -Destination "frontend/src/types/" -Force
Move-Item -Path "src/lib/*" -Destination "frontend/src/lib/" -Force
Move-Item -Path "src/app/globals.css" -Destination "frontend/src/app/" -Force
Move-Item -Path "tailwind.config.js" -Destination "frontend/" -Force
Move-Item -Path "postcss.config.js" -Destination "frontend/" -Force
Move-Item -Path "tsconfig.json" -Destination "frontend/" -Force

# Clean up old directories
Remove-Item -Path "src" -Recurse -Force 
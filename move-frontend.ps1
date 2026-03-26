# Move frontend files
Copy-Item -Path "src/app/*" -Destination "frontend/src/app/" -Recurse -Force
Copy-Item -Path "src/components/*" -Destination "frontend/src/components/" -Recurse -Force
Copy-Item -Path "src/types/*" -Destination "frontend/src/types/" -Recurse -Force
Copy-Item -Path "src/lib/*" -Destination "frontend/src/lib/" -Recurse -Force
Copy-Item -Path "src/app/globals.css" -Destination "frontend/src/app/" -Force
Copy-Item -Path "tailwind.config.js" -Destination "frontend/" -Force
Copy-Item -Path "postcss.config.js" -Destination "frontend/" -Force
Copy-Item -Path "tsconfig.json" -Destination "frontend/" -Force

# Clean up old directories
Remove-Item -Path "src" -Recurse -Force 
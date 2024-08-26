echo "[+] deleting node modules"
rm -rf ./node_modules
echo "[+] node modules deleted"

npm install
echo "[+] npm installed\n\n"
echo ""
npm run build
echo "[+] Compilation complete"
echo ""
mkdir -p ./dist/uploads/events
mkdir -p ./dist/uploads/grounds
mkdir -p ./dist/uploads/profile
mkdir -p ./dist/uploads/sports
mkdir -p ./dist/uploads/venue
echo "[+] local file directories created"
echo ""

# npm run pre-deployment
echo "[+] Pre deployment measures were taken, like super admin and menu generation"
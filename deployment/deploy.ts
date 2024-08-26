import { Admin, Employee, Menu } from "../schemas/schema";
import bcrypt from 'bcrypt';

class D3 {
    async add_superadmin() {
        try {
            const employees = [
                {
                    first_name: "Nishant",
                    last_name: "Mishra",
                    email: "nishant.mishra@jabotics.in",
                    password: "Jab@2024",
                    mobile: "9504559316",
                    email_verified: true,
                    is_superadmin: true
                }
            ];

            const promises: any[] = [];
            employees.forEach(async (employeeData) => {
                const { first_name, last_name, email, mobile, email_verified, is_superadmin } = employeeData;
                const hashedPassword = await bcrypt.hash(employeeData.password, 10);
                const newEmployee = new Admin({
                    first_name,
                    last_name,
                    email,
                    password: hashedPassword,
                    mobile,
                    email_verified,
                    is_superadmin
                });

                promises.push(newEmployee.save());
            });

            await Promise.all(promises);
            console.log("Super Admin added successfully");

            // const menuPromises: any[] = [];
            // const menus = ['EMPLOYEES', 'CUSTOMERS', 'CITIES', 'MENUS', 'ROLES', 'VENUES', 'GROUNDS', 'ADMINS'];
            // menus.forEach(async (menu) => {
            //     const newMenus = new Menu({
            //         name: menu
            //     });

            //     menuPromises.push(newMenus.save());
            // });

            // await Promise.all(menuPromises);
            // console.log('Menu Added Successfully');
        }
        catch (err) {
            console.log(err);
        }
    }
}

async function main() {
    const handler = new D3();
    await handler.add_superadmin();
}

main();
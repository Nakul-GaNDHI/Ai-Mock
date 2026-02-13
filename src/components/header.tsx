import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/clerk-react";
import { Container } from "./container";
import { NavLink } from "react-router-dom";
import { ProfileContainer } from "./profile-container";

const Header = () => {
  const { userId } = useAuth();

  return (
    <header
      className={cn("w-full border-b duration-150 transition-all ease-in-out")}
    >
      <Container>
        <div className="flex items-center justify-between w-full">
          
          {/* Only Take An Interview */}
          {userId && (
            <NavLink
              to={"/generate"}
              className={({ isActive }) =>
                cn(
                  "text-base text-neutral-600",
                  isActive && "text-neutral-900 font-semibold"
                )
              }
            >
              Take An Interview
            </NavLink>
          )}

          {/* Profile */}
          <ProfileContainer />
        </div>
      </Container>
    </header>
  );
};

export default Header;

using System.Security.Claims;
using API.Contracts.Auth;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly IUserService _userService;

    public AuthController(SignInManager<IdentityUser> signInManager, UserManager<IdentityUser> userManager,
        IUserService userService)
    {
        _signInManager = signInManager;
        _userManager = userManager;
        _userService = userService;
    }

    [HttpPost("Register")]
    public async Task<ActionResult<RegistrationResponse>> Register(RegistrationRequest request)
    {
        var user = new IdentityUser { Email = request.Email, UserName = request.Email };
        var identityResult = await _userManager.CreateAsync(user, request.Password);

        if (!identityResult.Succeeded)
        {
            foreach (var error in identityResult.Errors)
            {
                if(error.Code != "DuplicateUserName")
                {
                    ModelState.AddModelError(error.Code, error.Description);
                }
            }

            return BadRequest(ModelState);
        }

        await _userManager.AddToRoleAsync(user, "User");
        await _signInManager.SignInAsync(user, isPersistent: true);

        return CreatedAtAction(nameof(Register), new RegistrationResponse(user.Email));
    }

    [HttpPost("Login")]
    public async Task<ActionResult<AuthResponse>> Authenticate([FromBody] AuthRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            ModelState.AddModelError("Login", "Invalid email or password.");
            return BadRequest(ModelState);
        }

        var result =
            await _signInManager.PasswordSignInAsync(user, request.Password, isPersistent: true,
                lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            ModelState.AddModelError("Login", "Invalid email or password.");
            return BadRequest(ModelState);
        }

        var loggedInUser = await _userService.GetUserByIdentityIdAsync(User);

        return Ok(new AuthResponse(
            user.Email,
            loggedInUser.Id,
            loggedInUser.Name)
        );
    }

    [Authorize]
    [HttpPost("Logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { Message = "Logged out successfully" });
    }

    [Authorize]
    [HttpGet("logged-in-user")]
    public async Task<ActionResult<AuthResponse>> GetAuthStatus()
    {
        var loggedInUser = await _userService.GetUserByIdentityIdAsync(User);

        return Ok(new AuthResponse(
            User.FindFirst(ClaimTypes.Email)?.Value,
            loggedInUser.Id,
            loggedInUser.Name)
        );
    }
}
using API.Contracts;
using API.Contracts.Photo;
using API.Contracts.UserProfile;
using API.Data.Models;
using API.Data.Repositories;
using API.Hubs;
using API.Utils.Exceptions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class MatchService : IMatchService
{
    private readonly IRepository<Swipes> _swipeRepository;
    private readonly IRepository<MatchInfo> _matchRepository;
    private readonly IRepository<Photo> _photoRepository;
    private readonly IRepository<User> _userRepository;
    private readonly IHubContext<NotificationHub, INotificationHubClient> _hubContext;

    public MatchService(IRepository<MatchInfo> matchRepository, IRepository<Swipes> swipeRepository,
        IHubContext<NotificationHub, INotificationHubClient> hubContext, IRepository<Photo> photoRepository, IRepository<User> userRepository)
    {
        _matchRepository = matchRepository;
        _swipeRepository = swipeRepository;
        _hubContext = hubContext;
        _photoRepository = photoRepository;
        _userRepository = userRepository;
    }


    public async Task<MatchInfo?> CreateMatchIfMutualAsync(User loggedInUser, User swipedUser)
    {
        
        var swipeResult = await _swipeRepository.FindFirstAsync(s =>
            s.UserId == swipedUser.Id && s.SwipeType == "right" && s.SwipedUserId == loggedInUser.Id);

        if (swipeResult == null)
        {
            return null;
        }

        var match = new MatchInfo
        {
            CreatedAt = DateTime.Now,
            Users = new List<User>
            {
                loggedInUser,
                swipedUser
            }
        };

        await _matchRepository.AddAsync(match);

        var pfp = await _photoRepository.FindFirstAsync(p => p.UserId == swipedUser.Id);
        var pfpDto = pfp is null ? null : new PhotoDto(pfp.Id, pfp.Url);
        
        var userPfp = await _photoRepository.FindFirstAsync(p => p.UserId == swipedUser.Id);
        var userpfpDto = userPfp is null ? null : new PhotoDto(userPfp.Id, userPfp.Url);

        var loggedInUserMatchNotification = new MatchNotification(pfpDto, swipedUser.Name, match.Id, swipedUser.Id);

        var otherUserMatchNotification =
            new MatchNotification(userpfpDto, loggedInUser.Name, match.Id, loggedInUser.Id);

        await _hubContext.Clients.User(loggedInUser.Id.ToString()).ReceiveMatchNotification(loggedInUserMatchNotification);
        await _hubContext.Clients.User(swipedUser.Id.ToString()).ReceiveMatchNotification(otherUserMatchNotification);

        return match;
    }

    public async Task<IEnumerable<MinimalProfileDataResponse>> GetMatchedUsersMinimalData(int loggedInUserId)
    {
        var matchedUsers = await _matchRepository
            .Query()
            .Where(m => m.Users.Any(u => u.Id == loggedInUserId))
            .SelectMany(m => m.Users
                .Where(u => u.Id != loggedInUserId)
                .Select(u => new
                {
                    User = u,
                    MatchDate = m.CreatedAt
                }))
            .Distinct()
            .ToListAsync();
        
        var userIds = matchedUsers.Select(u => u.User.Id).ToList();
        
        var userPhotos = await _userRepository
            .Query()
            .Where(u => userIds.Contains(u.Id))
            .Where(u => u.Photos.Any())
            .Select(u => new
            {
                u.Id,
                PhotoUrl = u.Photos.OrderBy(p => p.Id).FirstOrDefault().Url
            })
            .ToListAsync();

        
        var minimalUsers = matchedUsers
            .Select(u => new MinimalProfileDataResponse(
                u.User.Id,
                u.User.Name,
                userPhotos.FirstOrDefault(p => p.Id == u.User.Id)?.PhotoUrl,
                u.MatchDate,
                u.User.LastActivityDate))
            .ToList();

        return minimalUsers;
    }
}
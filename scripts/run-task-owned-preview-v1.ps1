[CmdletBinding(DefaultParameterSetName = 'Run')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$RepositoryPath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$WorktreePath,
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$NodeExecutable,
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [ValidateRange(1, 65535)]
    [int]$Port,
    [Parameter(Mandatory = $true, ParameterSetName = 'Run')]
    [string]$ExecutionInstanceId,
    [Parameter(Mandatory = $false, ParameterSetName = 'Run')]
    [string]$HostAddress = '127.0.0.1',
    [Parameter(Mandatory = $true, ParameterSetName = 'SelfTest')]
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'preview_job_host_unsupported' }

$jobSource = @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public sealed class TaskOwnedPreviewJobV1 : IDisposable
{
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    const uint WAIT_OBJECT_0 = 0x00000000;
    const uint WAIT_TIMEOUT = 0x00000102;
    const int JobObjectBasicAccountingInformation = 1;
    const int JobObjectExtendedLimitInformation = 9;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION
    {
        public IntPtr hProcess, hThread;
        public uint dwProcessId, dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
    {
        public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int informationClass, IntPtr information, uint informationLength);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryInformationJobObject(IntPtr job, int informationClass, IntPtr information, uint informationLength, out uint returnLength);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateProcessW(string applicationName, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref STARTUPINFO startupInfo, out PROCESS_INFORMATION processInformation);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    IntPtr job;
    Process root;
    bool disposed;

    TaskOwnedPreviewJobV1(IntPtr jobHandle, Process rootProcess)
    {
        job = jobHandle;
        root = rootProcess;
    }

    static string Quote(string value)
    {
        if (value.Length != 0 && value.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) return value;
        var result = new StringBuilder("\"");
        int backslashes = 0;
        foreach (char current in value)
        {
            if (current == '\\') { backslashes++; continue; }
            if (current == '"')
            {
                result.Append('\\', backslashes * 2 + 1).Append('"');
                backslashes = 0;
                continue;
            }
            result.Append('\\', backslashes).Append(current);
            backslashes = 0;
        }
        result.Append('\\', backslashes * 2).Append('"');
        return result.ToString();
    }

    static Exception NativeFailure(string reason)
    {
        return new InvalidOperationException(reason, new Win32Exception(Marshal.GetLastWin32Error()));
    }

    public static TaskOwnedPreviewJobV1 Start(string executable, string[] arguments, string workingDirectory)
    {
        IntPtr jobHandle = CreateJobObjectW(IntPtr.Zero, null);
        if (jobHandle == IntPtr.Zero) throw NativeFailure("preview_job_creation_failed");
        IntPtr limits = IntPtr.Zero;
        PROCESS_INFORMATION process = new PROCESS_INFORMATION();
        try
        {
            var extended = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            extended.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            int size = Marshal.SizeOf<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>();
            limits = Marshal.AllocHGlobal(size);
            Marshal.StructureToPtr(extended, limits, false);
            if (!SetInformationJobObject(jobHandle, JobObjectExtendedLimitInformation, limits, (uint)size))
                throw NativeFailure("preview_job_configuration_failed");

            var commandLine = new StringBuilder(Quote(executable));
            foreach (string argument in arguments) commandLine.Append(' ').Append(Quote(argument));
            var startup = new STARTUPINFO();
            startup.cb = Marshal.SizeOf<STARTUPINFO>();
            if (!CreateProcessW(executable, commandLine, IntPtr.Zero, IntPtr.Zero, false, CREATE_SUSPENDED, IntPtr.Zero, workingDirectory, ref startup, out process))
                throw NativeFailure("preview_process_start_failed");
            if (!AssignProcessToJobObject(jobHandle, process.hProcess))
                throw NativeFailure("preview_process_tree_identity_unproven");
            if (ResumeThread(process.hThread) == UInt32.MaxValue)
                throw NativeFailure("preview_process_resume_failed");

            var owner = new TaskOwnedPreviewJobV1(jobHandle, Process.GetProcessById((int)process.dwProcessId));
            jobHandle = IntPtr.Zero;
            return owner;
        }
        catch
        {
            if (process.hProcess != IntPtr.Zero) TerminateProcess(process.hProcess, 1);
            throw;
        }
        finally
        {
            if (process.hThread != IntPtr.Zero) CloseHandle(process.hThread);
            if (process.hProcess != IntPtr.Zero) CloseHandle(process.hProcess);
            if (limits != IntPtr.Zero) Marshal.FreeHGlobal(limits);
            if (jobHandle != IntPtr.Zero) CloseHandle(jobHandle);
        }
    }

    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION Accounting()
    {
        int size = Marshal.SizeOf<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>();
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try
        {
            uint returned;
            if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, buffer, (uint)size, out returned) || returned < size)
                throw NativeFailure("preview_process_tree_identity_unproven");
            return Marshal.PtrToStructure<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>(buffer);
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    public Process RootProcess { get { return root; } }
    public int RootProcessId { get { return root.Id; } }
    public long RootStartTimeUtc { get { return root.StartTime.ToUniversalTime().Ticks; } }
    public uint TotalProcesses { get { return Accounting().TotalProcesses; } }
    public uint ActiveProcesses { get { return Accounting().ActiveProcesses; } }

    public void VerifyTerminal(uint timeoutMilliseconds)
    {
        uint wait = WaitForSingleObject(job, timeoutMilliseconds);
        if (wait == WAIT_TIMEOUT) throw new InvalidOperationException("preview_process_tree_absence_unproven");
        if (wait != WAIT_OBJECT_0) throw NativeFailure("preview_process_tree_absence_unproven");
        if (Accounting().ActiveProcesses != 0) throw new InvalidOperationException("preview_process_tree_absence_unproven");
    }

    public void TerminateAndVerify(uint timeoutMilliseconds)
    {
        if (!TerminateJobObject(job, 0)) throw NativeFailure("preview_process_tree_termination_failed");
        VerifyTerminal(timeoutMilliseconds);
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        try
        {
            if (job != IntPtr.Zero && Accounting().ActiveProcesses != 0)
            {
                TerminateJobObject(job, 1);
                WaitForSingleObject(job, 10000);
            }
        }
        finally
        {
            if (root != null) root.Dispose();
            if (job != IntPtr.Zero) CloseHandle(job);
            job = IntPtr.Zero;
        }
    }
}
'@

Add-Type -TypeDefinition $jobSource -ErrorAction Stop

function Get-NormalizedExistingPath {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][ValidateSet('Container', 'Leaf')][string]$PathType)
    if (-not (Test-Path -LiteralPath $Path -PathType $PathType)) { throw 'preview_execution_identity_invalid' }
    return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\', '/')
}

function Invoke-SelfTest {
    $currentPwsh = [IO.Path]::GetFullPath([Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
    $eventName = 'Local\TaskPreviewSelfTest-' + [guid]::NewGuid().ToString('N')
    $ready = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, $eventName)
    $owner = $null
    try {
        $childCommand = '$ready=[Threading.EventWaitHandle]::OpenExisting(''' + $eventName + '''); $child=Start-Process -FilePath $PSHOME/pwsh -ArgumentList @(''-NoProfile'',''-Command'',''Start-Sleep -Seconds 300'') -PassThru; [void]$ready.Set(); Start-Sleep -Seconds 300'
        $owner = [TaskOwnedPreviewJobV1]::Start($currentPwsh, @('-NoProfile', '-Command', $childCommand), (Get-Location).Path)
        if (-not $ready.WaitOne(5000) -or $owner.TotalProcesses -lt 2) { throw 'preview_process_tree_identity_unproven' }

        $terminalUncertaintyRejected = $false
        try { $owner.VerifyTerminal(0) }
        catch {
            $failure = $_.Exception
            while ($null -ne $failure.InnerException) { $failure = $failure.InnerException }
            if ($failure.Message -cne 'preview_process_tree_absence_unproven') { throw }
            $terminalUncertaintyRejected = $true
        }
        if (-not $terminalUncertaintyRejected) { throw 'preview_process_tree_absence_unproven' }

        $treeSize = $owner.TotalProcesses
        $owner.TerminateAndVerify(10000)
        return [pscustomobject]@{
            state = 'PASS'
            exact_job_process_count = $treeSize
            terminal_uncertainty_rejected = $true
            process_tree_absent = $owner.ActiveProcesses -eq 0
        }
    }
    finally {
        if ($null -ne $owner) { $owner.Dispose() }
        $ready.Dispose()
    }
}

if ($SelfTest) {
    Invoke-SelfTest | ConvertTo-Json -Compress
    exit 0
}

$repository = Get-NormalizedExistingPath -Path $RepositoryPath -PathType Container
$worktree = Get-NormalizedExistingPath -Path $WorktreePath -PathType Container
$node = Get-NormalizedExistingPath -Path $NodeExecutable -PathType Leaf
$worktreesRoot = [IO.Path]::GetFullPath((Join-Path $repository '.worktrees')).TrimEnd('\', '/')
if (-not $worktree.StartsWith($worktreesRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'preview_execution_identity_invalid' }
if ((Get-Item -LiteralPath $worktree -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'preview_execution_identity_invalid' }
$executionGuid = [guid]::Empty
if (-not [guid]::TryParse($ExecutionInstanceId, [ref]$executionGuid) -or $executionGuid -eq [guid]::Empty) { throw 'preview_execution_identity_invalid' }

$viteScript = Get-NormalizedExistingPath -Path (Join-Path $worktree 'node_modules/vite/bin/vite.js') -PathType Leaf
$owner = $null
$previewExitCode = $null
$terminationMode = $null
$rootProcessId = $null
$rootStartTimeUtc = $null
$treeSize = $null
try {
    $owner = [TaskOwnedPreviewJobV1]::Start($node, @($viteScript, 'preview', '--host', $HostAddress, '--port', [string]$Port), $worktree)
    $rootProcessId = $owner.RootProcessId
    $rootStartTimeUtc = $owner.RootStartTimeUtc
    $exitTask = $owner.RootProcess.WaitForExitAsync()
    $controlTask = [Console]::In.ReadLineAsync()
    $completedTask = [Threading.Tasks.Task]::WhenAny($exitTask, $controlTask).GetAwaiter().GetResult()
    if ([object]::ReferenceEquals($completedTask, $exitTask)) {
        $previewExitCode = $owner.RootProcess.ExitCode
        $terminationMode = 'NATURAL_EXIT'
        $owner.VerifyTerminal(10000)
    }
    else {
        $control = $controlTask.GetAwaiter().GetResult()
        if ($control -cne 'STOP') { throw 'preview_control_command_invalid' }
        $terminationMode = 'OWNER_STOP'
        $treeSize = $owner.TotalProcesses
        $owner.TerminateAndVerify(10000)
    }
    if ($null -eq $treeSize) { $treeSize = $owner.TotalProcesses }
    if ($owner.ActiveProcesses -ne 0) { throw 'preview_process_tree_absence_unproven' }
}
finally {
    if ($null -ne $owner) { $owner.Dispose() }
}

if ($terminationMode -eq 'NATURAL_EXIT' -and $previewExitCode -ne 0) { throw 'preview_process_failed' }
[pscustomobject]@{
    state = 'COMPLETED'
    execution_instance_id = $executionGuid.ToString()
    worktree_path = $worktree
    root_process_id = $rootProcessId
    root_start_time_utc_ticks = $rootStartTimeUtc
    exact_job_process_count = $treeSize
    termination_mode = $terminationMode
    process_tree_absent = $true
} | ConvertTo-Json -Compress
